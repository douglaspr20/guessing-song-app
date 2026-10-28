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
  }));
}

export async function kickParticipant(gameId: string, participantId: string) {
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
