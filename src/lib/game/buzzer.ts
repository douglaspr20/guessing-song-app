import "server-only";
import type { Participant, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { emit } from "./events";
import { isCorrectArtist, isCorrectGuess } from "./matcher";
import { elapsedMs, fragmentEnded } from "./scoring";
import { award, emitAward, loadRound } from "./service";

/**
 * El pulsador: quien juega desde el móvil pulsa «¡Lo sé!», el reloj de la ronda se para (la tele
 * pausa la música) y esa persona tiene `answerSeconds` para escribir título y artista. Si acierta
 * el título gana la ronda; si falla o se le acaba el tiempo queda fuera de esta pista (ella sola o
 * todo su equipo, según el ajuste de la partida) y la canción sigue.
 *
 * Todo se decide en el servidor con actualizaciones condicionales: si dos pulsan a la vez, solo uno
 * se queda el turno, y un mismo turno solo se cierra una vez aunque lleguen a la vez la respuesta del
 * móvil y la orden de la tele.
 */

/** Margen por la red: una respuesta que llega justo al acabarse el tiempo aún vale. */
export const BUZZ_GRACE_MS = 2_000;

type Tx = Prisma.TransactionClient;
type LoadedRound = Awaited<ReturnType<typeof loadRound>>;
type Seat = Pick<Participant, "id" | "playerId" | "name">;

/** Cierra el turno si sigue siendo de `participantId`. Devuelve false si ya lo cerró otro. */
async function clearBuzz(tx: Tx, roundId: string, participantId: string) {
  const { count } = await tx.round.updateMany({
    where: { id: roundId, status: "PLAYING", buzzParticipantId: participantId },
    data: { buzzParticipantId: null, buzzedAt: null, buzzDeadline: null },
  });
  return count > 0;
}

/** Quita la pausa del turno y descuenta ese rato del reloj: pensar la respuesta no gasta puntos. */
async function resumeInTx(tx: Tx, roundId: string, now: Date) {
  const r = await tx.round.findUniqueOrThrow({ where: { id: roundId } });
  if (!r.pausedAt) return;
  await tx.round.update({
    where: { id: roundId },
    data: { pausedAt: null, pausedMs: r.pausedMs + Math.max(0, now.getTime() - r.pausedAt.getTime()) },
  });
}

/** Deja fuera de esta ronda a la persona, o a todo su equipo si así se configuró la partida. */
async function lockOut(tx: Tx, round: LoadedRound, seat: Seat) {
  const wholeTeam = round.game.lockout === "team" && round.game.format === "teams";
  await tx.roundLockout.createMany({
    data: [wholeTeam ? { roundId: round.id, playerId: seat.playerId } : { roundId: round.id, participantId: seat.id }],
    skipDuplicates: true,
  });
}

/** ¿Esta persona (o su equipo) ya no puede pulsar en esta ronda? */
export async function isLockedOut(roundId: string, seat: Pick<Participant, "id" | "playerId">) {
  const row = await db.roundLockout.findFirst({
    where: { roundId, OR: [{ participantId: seat.id }, { playerId: seat.playerId }] },
    select: { id: true },
  });
  return !!row;
}

/** Cierra el turno como fallo (respuesta mala, sin respuesta o tiempo agotado). */
async function settleFailure(round: LoadedRound, seat: Seat, outcome: "wrong" | "timeout") {
  const now = new Date();
  const settled = await db.$transaction(async (tx) => {
    if (!(await clearBuzz(tx, round.id, seat.id))) return false;
    await lockOut(tx, round, seat);
    await resumeInTx(tx, round.id, now);
    return true;
  });
  if (settled) {
    emit({
      type: "buzz_resolved",
      gameId: round.gameId,
      roundId: round.id,
      participantId: seat.id,
      name: seat.name,
      correct: false,
      outcome,
    });
  }
  return settled;
}

const pastDeadline = (round: LoadedRound, now = new Date()) =>
  !!round.buzzDeadline && now.getTime() > round.buzzDeadline.getTime() + BUZZ_GRACE_MS;

/** Si quien tenía el turno ya se pasó de tiempo (y nadie lo cerró), lo cierra ahora. */
async function settleIfExpired(round: LoadedRound) {
  if (!round.buzzParticipantId || !pastDeadline(round)) return;
  const seat = await db.participant.findUnique({ where: { id: round.buzzParticipantId } });
  if (seat) await settleFailure(round, seat, "timeout");
}

// ---------- Pulsar ----------

export async function buzz(gameId: string, roundId: string, seat: Seat) {
  let round = await loadRound(gameId, roundId);
  await settleIfExpired(round);
  round = await loadRound(gameId, roundId);

  if (round.status !== "PLAYING") throw new AppError("ROUND_CLOSED", 409);
  if (!round.playStartedAt) throw new AppError("ROUND_NOT_STARTED", 409);
  if (await isLockedOut(roundId, seat)) {
    throw new AppError("LOCKED_OUT", 409);
  }
  if (round.buzzParticipantId) throw await takenBy(round.buzzParticipantId);
  if (round.pausedAt) {
    const ended = fragmentEnded({
      fragmentMs: round.game.fragmentSeconds * 1000,
      elapsedMs: elapsedMs(round, new Date()),
    });
    throw ended
      ? new AppError("FRAGMENT_ENDED", 409)
      : new AppError("PAUSED", 409);
  }

  const now = new Date();
  // El reclamo es una sola actualización condicional: si dos pulsan a la vez, solo una cuenta.
  const { count } = await db.round.updateMany({
    where: { id: roundId, status: "PLAYING", buzzParticipantId: null, pausedAt: null, playStartedAt: { not: null } },
    data: {
      buzzParticipantId: seat.id,
      buzzedAt: now,
      buzzDeadline: new Date(now.getTime() + round.game.answerSeconds * 1000),
      pausedAt: now,
    },
  });
  if (!count) {
    const after = await db.round.findUniqueOrThrow({ where: { id: roundId } });
    if (after.buzzParticipantId) throw await takenBy(after.buzzParticipantId);
    throw new AppError("BUZZ_FAILED", 409);
  }

  emit({ type: "buzz", gameId, roundId, participantId: seat.id, name: seat.name });
  return { answerSeconds: round.game.answerSeconds };
}

async function takenBy(participantId: string) {
  const who = await db.participant.findUnique({ where: { id: participantId }, select: { name: true } });
  return who
    ? new AppError("BUZZ_TAKEN", 409, { params: { name: who.name } })
    : new AppError("BUZZ_TAKEN", 409, { key: "BUZZ_TAKEN_ANON" });
}

// ---------- Responder ----------

export async function answer(
  gameId: string,
  roundId: string,
  seat: Seat,
  input: { title?: string; artist?: string },
) {
  const round = await loadRound(gameId, roundId);
  if (round.status !== "PLAYING") throw new AppError("ROUND_CLOSED", 409);
  if (round.buzzParticipantId !== seat.id) throw new AppError("NOT_YOUR_TURN", 409);
  if (pastDeadline(round)) {
    await settleFailure(round, seat, "timeout");
    throw new AppError("TIME_UP", 409);
  }

  const title = input.title?.trim() || null;
  const artist = input.artist?.trim() || null;
  const titleCorrect = !!title && isCorrectGuess(title, round.trackName);
  const artistCorrect = !!artist && isCorrectArtist(artist, JSON.parse(round.artists));
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    if (!(await clearBuzz(tx, round.id, seat.id))) throw new AppError("NOT_YOUR_TURN", 409);
    const a = await award(tx, round, seat.playerId, { title: titleCorrect, artist: artistCorrect, at: now });
    if (title || artist) {
      await tx.guess.create({
        data: {
          roundId,
          playerId: seat.playerId,
          participantId: seat.id,
          titleText: title,
          artistText: artist,
          titleCorrect,
          artistCorrect,
          points: a.points,
          createdAt: now,
        },
      });
    }
    // Sin el título se queda fuera y la canción sigue; con él la ronda está ganada.
    if (!a.titleAwarded) {
      await lockOut(tx, round, seat);
      await resumeInTx(tx, round.id, now);
    }
    return a;
  });

  await emitAward(gameId, roundId, seat.playerId, result);
  emit({
    type: "buzz_resolved",
    gameId,
    roundId,
    participantId: seat.id,
    name: seat.name,
    correct: result.titleAwarded,
    outcome: result.titleAwarded ? "correct" : "wrong",
  });
  return {
    titleCorrect,
    artistCorrect,
    titleAwarded: result.titleAwarded,
    artistAwarded: result.artistAwarded,
    points: result.points,
    lockedOut: !result.titleAwarded,
  };
}

// ---------- El anfitrión cierra el turno ----------

/**
 * Desde la tele: `expire` cierra el turno si ya pasó el tiempo, `fail` lo da por fallado y `cancel`
 * lo cancela sin dejar fuera a nadie (por si pulsó sin querer).
 */
export async function resolveBuzz(gameId: string, roundId: string, mode: "expire" | "fail" | "cancel") {
  const round = await loadRound(gameId, roundId);
  if (round.status !== "PLAYING" || !round.buzzParticipantId) return { settled: false };
  if (mode === "expire" && !pastDeadline(round)) return { settled: false };

  const seat = await db.participant.findUnique({ where: { id: round.buzzParticipantId } });
  if (mode === "cancel" || !seat) {
    const participantId = round.buzzParticipantId;
    const settled = await db.$transaction(async (tx) => {
      if (!(await clearBuzz(tx, round.id, participantId))) return false;
      await resumeInTx(tx, round.id, new Date());
      return true;
    });
    if (settled) {
      emit({ type: "buzz_resolved", gameId, roundId, participantId, name: seat?.name ?? "", correct: false, outcome: "cancelled" });
    }
    return { settled };
  }
  return { settled: await settleFailure(round, seat, mode === "expire" ? "timeout" : "wrong") };
}
