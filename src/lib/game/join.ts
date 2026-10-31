import "server-only";
import { cookies } from "next/headers";
import { recordGameEvent } from "@/lib/analytics/events";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { randomToken, sha256 } from "@/lib/access/hash";
import { cookieName, cookieOptions } from "@/lib/access/request";
import { notFound } from "@/lib/access/session";
import { emit } from "./events";
import { MAX_PEOPLE } from "./teams";

/** Unirse a una partida desde el móvil o el PC con su código de 6 caracteres. */

export const JOIN_LIMITS = {
  /** Códigos inválidos por IP dentro de la ventana antes de responder 429. */
  badCodesPerIp: 20,
  windowMs: 15 * 60_000,
  /** Participantes por partida. */
  maxParticipants: 40,
  /** Jugadores sueltos por partida (el mismo tope que al crearla). */
  maxSolo: 20,
};

const PARTICIPANT_TTL_SECONDS = 24 * 60 * 60;
const participantCookie = (gameId: string) => cookieName(`p_${gameId}`);

/** Mayúsculas y sin espacios ni guiones: «ab c-123» → «ABC123». */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const isCodeShape = (code: string) => /^[A-Z0-9]{6}$/.test(code);

// ---------- Límite de intentos ----------

// Se reutiliza la tabla de intentos de acceso con una clave propia, para no mezclar los códigos
// fallidos con los fallos de contraseña.
const attemptKey = (ipHash: string) => `join:${ipHash}`;

async function assertCodeAttemptsAllowed(ipHash: string, now = new Date()) {
  const bad = await db.loginAttempt.count({
    where: { ipHash: attemptKey(ipHash), ok: false, createdAt: { gt: new Date(now.getTime() - JOIN_LIMITS.windowMs) } },
  });
  if (bad >= JOIN_LIMITS.badCodesPerIp) {
    throw new AppError("TOO_MANY_ATTEMPTS", 429, { key: "TOO_MANY_CODES" });
  }
}

const recordBadCode = (ipHash: string) => db.loginAttempt.create({ data: { ipHash: attemptKey(ipHash), ok: false } });

const gameNotFound = () => new AppError("CODE_NOT_FOUND", 404);

async function findJoinableGame(rawCode: string, ipHash: string) {
  await assertCodeAttemptsAllowed(ipHash);
  const code = normalizeCode(rawCode);
  const game = isCodeShape(code)
    ? await db.game.findUnique({
        where: { code },
        include: {
          players: { include: { members: true } },
          participants: { where: { kickedAt: null } },
        },
      })
    : null;
  // Una partida terminada ya no admite a nadie.
  if (!game || game.status === "FINISHED") {
    await recordBadCode(ipHash);
    throw gameNotFound();
  }
  return game;
}

// ---------- Consulta del código ----------

/** Lo que se enseña al escribir un código: formato, equipos con hueco y nombres ya apuntados sin reclamar. */
export async function lookupGame(rawCode: string, ipHash: string) {
  const game = await findJoinableGame(rawCode, ipHash);
  const claimedPlayers = new Set(game.participants.map((p) => p.playerId));
  const claimedMembers = new Set(game.participants.map((p) => p.memberId).filter(Boolean));
  const teams = game.format === "teams";
  return {
    code: game.code,
    format: game.format as "solo" | "teams",
    joinOpen: game.joinOpen,
    full: game.participants.length >= JOIN_LIMITS.maxParticipants,
    maxTeamSize: game.maxTeamSize,
    teams: teams
      ? game.players.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          members: p.members.map((m) => m.name),
          free: Math.max(0, (game.maxTeamSize ?? 0) - p.members.length),
        }))
      : [],
    /** Nombres que el anfitrión ya apuntó y nadie ha reclamado: «¿Eres Ana?». */
    pending: teams
      ? game.players.flatMap((p) => p.members.filter((m) => !claimedMembers.has(m.id)).map((m) => m.name))
      : game.players.filter((p) => !claimedPlayers.has(p.id)).map((p) => p.name),
  };
}

// ---------- Unirse ----------

export interface JoinInput {
  code: string;
  /** Nombre (si no hay cuenta). */
  name?: string;
  /** Equipo elegido (solo por equipos y solo si el nombre no estaba ya apuntado). */
  teamId?: string;
}

export interface JoinContext {
  ipHash: string;
  /** Cuenta con sesión iniciada, si la hay. */
  user: { id: string; displayName: string } | null;
}

const cleanName = (raw: string | undefined) => (raw ?? "").trim().replace(/\s+/g, " ");

export async function joinGame(input: JoinInput, ctx: JoinContext, opts: { followed?: boolean } = {}) {
  const game = await findJoinableGame(input.code, ctx.ipHash);
  if (!game.joinOpen) throw new AppError("JOIN_CLOSED", 403);

  const name = cleanName(ctx.user ? (input.name || ctx.user.displayName) : input.name);
  if (!name || name.length > 30) throw new AppError("INVALID_NAME", 422);

  // Quien ya entró desde este navegador y vuelve a escribir su nombre (p. ej. al escanear otra vez el QR)
  // sigue siendo él: se le devuelve su sitio en vez de decirle que su nombre está ocupado.
  const mine = await currentParticipant(game.id);
  if (mine && mine.name.toLowerCase() === name.toLowerCase()) {
    return { gameId: game.id, participantId: mine.id, playerId: mine.playerId, name: mine.name };
  }

  const token = randomToken();
  const tokenHash = sha256(token);

  const participant = await db.$transaction(async (tx) => {
    // Un solo registro a la vez por partida: así dos personas no reclaman el mismo nombre.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${game.id}))`;

    const fresh = await tx.game.findUniqueOrThrow({
      where: { id: game.id },
      include: { players: { include: { members: true } }, participants: true },
    });

    // La misma cuenta en la misma partida recupera su sitio en vez de duplicarse.
    if (ctx.user) {
      const mine = fresh.participants.find((p) => p.userId === ctx.user!.id);
      if (mine?.kickedAt) throw new AppError("KICKED", 403);
      if (mine) return tx.participant.update({ where: { id: mine.id }, data: { tokenHash } });
    }

    const active = fresh.participants.filter((p) => !p.kickedAt);
    if (active.length >= JOIN_LIMITS.maxParticipants) {
      throw new AppError("GAME_FULL", 409);
    }
    const lower = name.toLowerCase();
    const nameTaken = () => new AppError("NAME_TAKEN", 409);

    if (fresh.format === "solo") {
      const existing = fresh.players.find((p) => p.name.toLowerCase() === lower);
      if (existing) {
        if (active.some((a) => a.playerId === existing.id)) throw nameTaken();
        return tx.participant.create({
          data: { gameId: fresh.id, playerId: existing.id, userId: ctx.user?.id, name: existing.name, tokenHash },
        });
      }
      if (fresh.players.length >= JOIN_LIMITS.maxSolo) throw new AppError("GAME_FULL", 409);
      const player = await tx.player.create({ data: { gameId: fresh.id, name } });
      return tx.participant.create({
        data: { gameId: fresh.id, playerId: player.id, userId: ctx.user?.id, name, tokenHash },
      });
    }

    // Por equipos: o el anfitrión ya lo apuntó con ese nombre, o elige un equipo con hueco.
    for (const team of fresh.players) {
      const member = team.members.find((m) => m.name.toLowerCase() === lower);
      if (!member) continue;
      if (active.some((a) => a.memberId === member.id)) throw nameTaken();
      return tx.participant.create({
        data: { gameId: fresh.id, playerId: team.id, memberId: member.id, userId: ctx.user?.id, name: member.name, tokenHash },
      });
    }
    const team = fresh.players.find((p) => p.id === input.teamId);
    if (!team) throw new AppError("TEAM_REQUIRED", 422);
    if (team.members.length >= (fresh.maxTeamSize ?? 0)) throw new AppError("TEAM_FULL", 409, { params: { team: team.name } });
    const people = fresh.players.reduce((n, p) => n + p.members.length, 0);
    if (people >= MAX_PEOPLE) throw new AppError("GAME_FULL", 409);
    const member = await tx.teamMember.create({ data: { playerId: team.id, name } });
    return tx.participant.create({
      data: { gameId: fresh.id, playerId: team.id, memberId: member.id, userId: ctx.user?.id, name, tokenHash },
    });
  });

  (await cookies()).set(participantCookie(game.id), token, cookieOptions(PARTICIPANT_TTL_SECONDS));
  emit({ type: "participant_joined", gameId: game.id, participantId: participant.id, name: participant.name });
  await recordGameEvent(opts.followed ? "phone_followed" : "phone_joined", game.id);
  return { gameId: game.id, participantId: participant.id, playerId: participant.playerId, name: participant.name };
}

/**
 * El móvil de quien jugó la partida anterior pasa a la que el anfitrión grabó con «Otra igual»: mismo nombre y
 * mismo sitio (jugador o equipo), porque la nueva se copió con ellos. Quien fue expulsado no tiene cookie válida
 * y no sigue.
 */
export async function followNextGame(gameId: string, ctx: JoinContext) {
  const me = await requireParticipant(gameId);
  const old = await db.game.findUnique({ where: { id: gameId }, select: { nextGame: { select: { code: true } } } });
  if (!old?.nextGame) throw new AppError("NO_NEXT_GAME", 404);
  return joinGame({ code: old.nextGame.code, name: me.name }, ctx, { followed: true });
}

// ---------- Recuperar el sitio ----------

/** La petición de otro navegador para quedarse con un sitio caduca pasado este tiempo. */
export const CLAIM_TTL_MS = 5 * 60_000;
/** Peticiones de sitio por conexión: pedir entrar es poco habitual, así que el tope es bajo. */
export const CLAIM_LIMITS = { perIp: 5, windowMs: 10 * 60_000 };

/** Cookie (aparte de `p_`) con el token del navegador que espera a que el anfitrión lo deje entrar. */
const claimCookie = (gameId: string) => cookieName(`c_${gameId}`);
const claimAttemptKey = (ipHash: string) => `claim:${ipHash}`;

/** ¿La petición sigue vigente? */
export const claimFresh = (claimAt: Date | null, now = new Date()) =>
  !!claimAt && now.getTime() - claimAt.getTime() < CLAIM_TTL_MS;

async function assertClaimAllowed(ipHash: string, now = new Date()) {
  const asked = await db.loginAttempt.count({
    where: { ipHash: claimAttemptKey(ipHash), createdAt: { gt: new Date(now.getTime() - CLAIM_LIMITS.windowMs) } },
  });
  if (asked >= CLAIM_LIMITS.perIp) throw new AppError("TOO_MANY_ATTEMPTS", 429);
  await db.loginAttempt.create({ data: { ipHash: claimAttemptKey(ipHash), ok: false } });
}

/**
 * Alguien perdió su sesión (abrió el enlace en otro navegador) y su nombre sigue ocupado: pide quedarse con ese
 * mismo sitio. No cambia nada hasta que el anfitrión lo acepte (`resolveClaim`); mientras, el navegador espera con
 * su propia cookie `c_`, que no pisa la `p_` por si ya tenía otro sitio en esta partida. No hace falta que la
 * entrada esté abierta: es volver, no entrar.
 */
export async function requestSeat(input: { code: string; name: string }, ctx: JoinContext) {
  const game = await findJoinableGame(input.code, ctx.ipHash);
  const name = cleanName(input.name);
  if (!name) throw new AppError("INVALID_NAME", 422);

  // Si este navegador ya es ese sitio, no hay nada que pedir.
  const mine = await currentParticipant(game.id);
  if (mine && mine.name.toLowerCase() === name.toLowerCase()) return { gameId: game.id, name: mine.name, already: true };

  const seat = await db.participant.findFirst({
    where: { gameId: game.id, kickedAt: null, name: { equals: name, mode: "insensitive" } },
  });
  if (!seat) throw new AppError("CLAIM_NOT_FOUND", 404);
  await assertClaimAllowed(ctx.ipHash);

  const token = randomToken();
  // Una petición nueva sustituye a la anterior (solo hay una pendiente por sitio).
  await db.participant.update({ where: { id: seat.id }, data: { claimHash: sha256(token), claimAt: new Date() } });
  (await cookies()).set(claimCookie(game.id), token, cookieOptions(CLAIM_TTL_MS / 1000));
  emit({ type: "claim_requested", gameId: game.id, participantId: seat.id, name: seat.name });
  return { gameId: game.id, name: seat.name, already: false };
}

/**
 * ¿Ya me han dejado entrar? Lo consulta el navegador que espera. `accepted`: ya es el sitio (su cookie `c_` pasa a
 * ser la `p_`); `pending`: sigue esperando; `gone`: lo rechazaron, otro lo sustituyó o caducó.
 */
export async function claimStatus(gameId: string, now = new Date()): Promise<"pending" | "accepted" | "gone"> {
  const jar = await cookies();
  const token = jar.get(claimCookie(gameId))?.value;
  if (!token) return "gone";
  const hash = sha256(token);

  const accepted = await db.participant.findUnique({ where: { tokenHash: hash } });
  if (accepted && accepted.gameId === gameId && !accepted.kickedAt) {
    jar.set(participantCookie(gameId), token, cookieOptions(PARTICIPANT_TTL_SECONDS));
    jar.delete(claimCookie(gameId));
    return "accepted";
  }
  const pending = await db.participant.findFirst({ where: { gameId, claimHash: hash, kickedAt: null } });
  return pending && claimFresh(pending.claimAt, now) ? "pending" : "gone";
}

/** El navegador que esperaba se arrepiente: se retira su petición y la tele deja de pedir respuesta. */
export async function withdrawClaim(gameId: string) {
  const jar = await cookies();
  const token = jar.get(claimCookie(gameId))?.value;
  if (!token) return;
  jar.delete(claimCookie(gameId));
  const hash = sha256(token);
  const seat = await db.participant.findFirst({ where: { gameId, claimHash: hash } });
  if (!seat) return;
  const { count } = await db.participant.updateMany({ where: { id: seat.id, claimHash: hash }, data: { claimHash: null, claimAt: null } });
  if (count) emit({ type: "claim_resolved", gameId, participantId: seat.id, accepted: false });
}

/**
 * El anfitrión deja entrar (el sitio pasa al token del navegador nuevo y el viejo queda fuera) o rechaza. Es el mismo
 * participante: conserva su equipo, sus puntos y sus fallos de la ronda.
 */
export async function resolveClaim(gameId: string, participantId: string, accept: boolean, now = new Date()) {
  const seat = await db.participant.findFirst({ where: { id: participantId, gameId, kickedAt: null } });
  if (!seat?.claimHash || !claimFresh(seat.claimAt, now)) throw new AppError("CLAIM_NOT_FOUND", 404);

  // Condicional: solo si sigue siendo la misma petición (otra pudo sustituirla mientras tanto).
  const { count } = await db.participant.updateMany({
    where: { id: seat.id, claimHash: seat.claimHash },
    data: accept ? { tokenHash: seat.claimHash, claimHash: null, claimAt: null } : { claimHash: null, claimAt: null },
  });
  if (!count) throw new AppError("CLAIM_NOT_FOUND", 404);
  if (accept) await recordGameEvent("seat_reclaimed", gameId);
  emit({ type: "claim_resolved", gameId, participantId, accepted: accept });
}

// ---------- Quién soy ----------

/** El participante de esta partida según su cookie, o null (también si lo echaron). */
export async function currentParticipant(gameId: string) {
  const token = (await cookies()).get(participantCookie(gameId))?.value;
  if (!token) return null;
  const p = await db.participant.findUnique({ where: { tokenHash: sha256(token) } });
  return p && p.gameId === gameId && !p.kickedAt ? p : null;
}

/** Como `currentParticipant`, pero responde 404 si no es de esta partida. */
export async function requireParticipant(gameId: string) {
  const p = await currentParticipant(gameId);
  if (!p) throw notFound();
  return p;
}

// ---------- Anfitrión ----------

/** Quién está conectado, para la lista de la tele. */
export async function listParticipants(gameId: string) {
  const rows = await db.participant.findMany({
    where: { gameId, kickedAt: null },
    orderBy: { createdAt: "asc" },
    include: { player: { select: { name: true, color: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    hasAccount: !!p.userId,
    team: p.player.color ? { name: p.player.name, color: p.player.color } : null,
    /** Otro navegador pide quedarse con su sitio: el anfitrión decide. */
    claim: !!p.claimHash && claimFresh(p.claimAt),
    /** Es el propio anfitrión, que también juega: no se le puede sacar. */
    host: p.isHost,
  }));
}

export async function kickParticipant(gameId: string, participantId: string) {
  const host = await db.participant.findFirst({ where: { id: participantId, gameId, isHost: true, kickedAt: null } });
  if (host) throw new AppError("CANT_KICK_HOST", 409);
  const { count } = await db.participant.updateMany({
    where: { id: participantId, gameId, kickedAt: null },
    data: { kickedAt: new Date() },
  });
  if (!count) throw new AppError("PARTICIPANT_NOT_FOUND", 404);
  emit({ type: "participant_left", gameId, participantId });
}

export async function setJoinOpen(gameId: string, open: boolean) {
  await db.game.update({ where: { id: gameId }, data: { joinOpen: open } });
  emit({ type: "join_toggled", gameId, open });
}

// ---------- El anfitrión también juega ----------

/**
 * El anfitrión juega desde su propia pantalla con uno de los nombres de la partida: este navegador pasa a ser
 * también ese participante (su cookie `p_`), con su «¡Lo sé!» y su turno. Quien llama ya comprobó que es el dueño.
 * Solo antes de la primera ronda; si ya jugaba con otro nombre, se cambia.
 */
export async function takeHostSeat(gameId: string, rawName: string) {
  const name = cleanName(rawName);
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { players: { include: { members: true } }, participants: { where: { kickedAt: null } } },
  });
  if (!game) throw new AppError("GAME_NOT_FOUND", 404);
  if (game.currentRound > 0 || game.status !== "LOBBY") throw new AppError("GAME_ALREADY_STARTED", 409);

  const lower = name.toLowerCase();
  const seat =
    game.format === "teams"
      ? game.players.flatMap((p) => p.members.map((m) => ({ playerId: p.id, memberId: m.id as string | null, name: m.name })))
          .find((s) => s.name.toLowerCase() === lower)
      : game.players.map((p) => ({ playerId: p.id, memberId: null as string | null, name: p.name })).find((s) => s.name.toLowerCase() === lower);
  if (!seat) throw new AppError("HOST_NAME_NOT_FOUND", 404);

  const current = game.participants.find((p) => p.isHost);
  const holder = game.participants.find((p) => (seat.memberId ? p.memberId === seat.memberId : p.playerId === seat.playerId));
  if (holder && holder.id !== current?.id) throw new AppError("NAME_TAKEN", 409);

  const token = randomToken();
  const data = { playerId: seat.playerId, memberId: seat.memberId, name: seat.name, tokenHash: sha256(token) };
  const participant = current
    ? await db.participant.update({ where: { id: current.id }, data })
    : await db.participant.create({ data: { ...data, gameId, isHost: true } });

  (await cookies()).set(participantCookie(gameId), token, cookieOptions(PARTICIPANT_TTL_SECONDS));
  emit({ type: "participant_joined", gameId, participantId: participant.id, name: participant.name });
  return { participantId: participant.id, name: participant.name };
}

/** El anfitrión deja de jugar (solo antes de la primera ronda): su sitio queda libre para un móvil. */
export async function leaveHostSeat(gameId: string) {
  const game = await db.game.findUnique({ where: { id: gameId }, select: { currentRound: true, status: true } });
  if (!game) throw new AppError("GAME_NOT_FOUND", 404);
  if (game.currentRound > 0 || game.status !== "LOBBY") throw new AppError("GAME_ALREADY_STARTED", 409);
  const host = await db.participant.findFirst({ where: { gameId, isHost: true, kickedAt: null } });
  (await cookies()).delete(participantCookie(gameId));
  if (!host) return;
  await db.participant.delete({ where: { id: host.id } });
  emit({ type: "participant_left", gameId, participantId: host.id });
}
