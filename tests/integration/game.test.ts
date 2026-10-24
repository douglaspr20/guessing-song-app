import { describe, expect, it } from "vitest";
import { registerGuest } from "@/lib/access/guest";
import type { Owner } from "@/lib/access/owner";
import { db } from "@/lib/db";
import { awardSpoken, createGame, getRoundGuesses } from "@/lib/game/service";

const code = (err: unknown) => (err as { code?: string }).code;
const fails = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    return { code: code(err), status: (err as { status?: number }).status };
  }
  throw new Error("Se esperaba un error");
};

/** Partida abierta con una ronda creada a mano (sin iTunes), que empezó a sonar hace `startedAgoMs`. */
async function gameWithRound({ startedAgoMs = 1_000 }: { startedAgoMs?: number | null } = {}) {
  const { guest } = await registerGuest("ip-juego");
  const owner: Owner = { kind: "guest", guestId: guest.id };
  const game = await createGame({ mode: "open", rounds: 3, players: ["Ana", "Luis"] }, owner);
  await db.game.update({ where: { id: game.id }, data: { status: "PLAYING", currentRound: 1 } });
  const round = await db.round.create({
    data: {
      gameId: game.id,
      number: 1,
      trackId: "t1",
      trackUri: "itunes:t1",
      trackName: "Bailando",
      artists: JSON.stringify(["Enrique Iglesias"]),
      durationMs: 30_000,
      startMs: 0,
      playStartedAt: startedAgoMs === null ? null : new Date(Date.now() - startedAgoMs),
    },
  });
  const [ana, luis] = game.players;
  return { gameId: game.id, roundId: round.id, ana, luis };
}

const score = async (playerId: string) => (await db.player.findUniqueOrThrow({ where: { id: playerId } })).score;

describe("«¡Acertó!» de palabra", () => {
  it("da la canción con los puntos del tramo actual y cierra la ronda con ganador", async () => {
    const { gameId, roundId, ana } = await gameWithRound();
    const r = await awardSpoken(gameId, roundId, ana.id, { title: true });

    expect(r).toMatchObject({ titleAwarded: true, artistAwarded: false, points: 3 });
    expect(await score(ana.id)).toBe(3);
    expect(await db.round.findUniqueOrThrow({ where: { id: roundId } })).toMatchObject({
      status: "WON",
      winnerPlayerId: ana.id,
    });
  });

  it("queda en los intentos como respuesta de palabra", async () => {
    const { gameId, roundId, ana } = await gameWithRound();
    await awardSpoken(gameId, roundId, ana.id, { artist: true });
    const [g] = await getRoundGuesses(gameId, roundId);
    expect(g).toMatchObject({
      playerId: ana.id,
      title: null,
      artist: null,
      titleCorrect: false,
      artistCorrect: true,
      overridden: true,
      points: 1,
    });
  });

  it("la canción solo se da una vez", async () => {
    const { gameId, roundId, ana, luis } = await gameWithRound();
    await awardSpoken(gameId, roundId, ana.id, { title: true });
    expect(await fails(awardSpoken(gameId, roundId, luis.id, { title: true }))).toMatchObject({
      code: "ROUND_CLOSED",
      status: 409,
    });
    expect(await score(luis.id)).toBe(0);
  });

  it("el artista solo uno y dentro de plazo", async () => {
    const early = await gameWithRound();
    await awardSpoken(early.gameId, early.roundId, early.ana.id, { artist: true });
    expect(await fails(awardSpoken(early.gameId, early.roundId, early.luis.id, { artist: true }))).toMatchObject({
      code: "AWARD_NOT_APPLIED",
      status: 409,
    });

    const late = await gameWithRound({ startedAgoMs: 25_000 });
    expect(await fails(awardSpoken(late.gameId, late.roundId, late.ana.id, { artist: true }))).toMatchObject({
      code: "AWARD_NOT_APPLIED",
    });
    expect(await getRoundGuesses(late.gameId, late.roundId)).toEqual([]);
  });

  it("no se da antes de que suene, sin nada que dar ni a un jugador de otra partida", async () => {
    const silent = await gameWithRound({ startedAgoMs: null });
    expect(await fails(awardSpoken(silent.gameId, silent.roundId, silent.ana.id, { title: true }))).toMatchObject({
      code: "ROUND_NOT_STARTED",
    });
    expect(await fails(awardSpoken(silent.gameId, silent.roundId, silent.ana.id, {}))).toMatchObject({
      code: "EMPTY_AWARD",
    });

    const other = await gameWithRound();
    expect(await fails(awardSpoken(other.gameId, other.roundId, silent.ana.id, { title: true }))).toMatchObject({
      status: 404,
    });
  });
});
