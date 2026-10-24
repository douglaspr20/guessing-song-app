import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { registerGuest } from "@/lib/access/guest";
import type { Owner } from "@/lib/access/owner";
import { db } from "@/lib/db";
import { answer, BUZZ_GRACE_MS, buzz, isLockedOut, resolveBuzz } from "@/lib/game/buzzer";
import { createGame, getGame, getRoundGuesses, resumeRound } from "@/lib/game/service";

const fails = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    return { code: (err as { code?: string }).code, status: (err as { status?: number }).status };
  }
  throw new Error("Se esperaba un error");
};

let guestCounter = 0;
async function newOwner(): Promise<Owner> {
  const { guest } = await registerGuest(`ip-buzz-${guestCounter++}`);
  return { kind: "guest", guestId: guest.id };
}

/** Quien se unió desde el móvil, creado directamente (sin pasar por la cookie). */
const seatFor = (gameId: string, playerId: string, name: string) =>
  db.participant.create({ data: { gameId, playerId, name, tokenHash: randomBytes(16).toString("hex") } });

/** Una ronda en juego que empezó a sonar hace 1 s, con la canción «Bailando». */
async function startRound(gameId: string, { started = true }: { started?: boolean } = {}) {
  await db.game.update({ where: { id: gameId }, data: { status: "PLAYING", currentRound: 1 } });
  return db.round.create({
    data: {
      gameId,
      number: 1,
      trackId: "t1",
      trackUri: "itunes:t1",
      trackName: "Bailando",
      artists: JSON.stringify(["Enrique Iglesias"]),
      durationMs: 30_000,
      startMs: 0,
      playStartedAt: started ? new Date(Date.now() - 1_000) : null,
    },
  });
}

async function soloSetup(opts: { started?: boolean } = {}) {
  const game = await createGame({ mode: "open", rounds: 2, players: ["Ana", "Luis"] }, await newOwner());
  const [ana, luis] = ["Ana", "Luis"].map((n) => game.players.find((p) => p.name === n)!);
  const round = await startRound(game.id, opts);
  const anaSeat = await seatFor(game.id, ana.id, "Ana");
  const luisSeat = await seatFor(game.id, luis.id, "Luis");
  return { game, round, ana, luis, anaSeat, luisSeat };
}

async function teamSetup(lockout: "person" | "team") {
  const game = await createGame(
    {
      mode: "open",
      rounds: 2,
      format: "teams",
      maxTeamSize: 3,
      lockout,
      teams: [
        { name: "Tomates", color: "teja", members: ["Ana", "Luis"] },
        { name: "Cielo", color: "cielo", members: ["Marta"] },
      ],
    },
    await newOwner(),
  );
  const tomates = game.players.find((p) => p.name === "Tomates")!;
  const cielo = game.players.find((p) => p.name === "Cielo")!;
  const round = await startRound(game.id);
  return {
    game,
    round,
    tomates,
    cielo,
    ana: await seatFor(game.id, tomates.id, "Ana"),
    luis: await seatFor(game.id, tomates.id, "Luis"),
    marta: await seatFor(game.id, cielo.id, "Marta"),
  };
}

const reload = (roundId: string) => db.round.findUniqueOrThrow({ where: { id: roundId } });
const score = async (playerId: string) => (await db.player.findUniqueOrThrow({ where: { id: playerId } })).score;

describe("pulsar «¡Lo sé!»", () => {
  it("da el turno, para el reloj y lo cuenta la partida pública", async () => {
    const { game, round, anaSeat } = await soloSetup();
    await buzz(game.id, round.id, anaSeat);

    const row = await reload(round.id);
    expect(row).toMatchObject({ buzzParticipantId: anaSeat.id });
    expect(row.pausedAt).not.toBeNull();
    expect(row.buzzDeadline!.getTime() - row.buzzedAt!.getTime()).toBe(20_000);

    const pub = (await getGame(game.id)).round!;
    expect(pub.paused).toBe(true);
    expect(pub.buzz).toMatchObject({ participantId: anaSeat.id, name: "Ana", totalMs: 20_000 });
    expect(pub.buzz!.remainingMs).toBeGreaterThan(19_000);
  });

  it("si dos pulsan a la vez, solo uno se queda el turno", async () => {
    const { game, round, anaSeat, luisSeat } = await soloSetup();
    const results = await Promise.allSettled([buzz(game.id, round.id, anaSeat), buzz(game.id, round.id, luisSeat)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const loser = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(["BUZZ_TAKEN", "BUZZ_FAILED"]).toContain(loser.reason.code);
    expect((await reload(round.id)).buzzParticipantId).not.toBeNull();
  });

  it("no se puede antes de que suene, con el anfitrión en pausa ni con la ronda cerrada", async () => {
    const silent = await soloSetup({ started: false });
    expect(await fails(buzz(silent.game.id, silent.round.id, silent.anaSeat))).toMatchObject({ code: "ROUND_NOT_STARTED" });

    const paused = await soloSetup();
    await db.round.update({ where: { id: paused.round.id }, data: { pausedAt: new Date() } });
    expect(await fails(buzz(paused.game.id, paused.round.id, paused.anaSeat))).toMatchObject({ code: "PAUSED" });

    const closed = await soloSetup();
    await db.round.update({ where: { id: closed.round.id }, data: { status: "REVEALED" } });
    expect(await fails(buzz(closed.game.id, closed.round.id, closed.anaSeat))).toMatchObject({ code: "ROUND_CLOSED" });
  });

  it("distingue «se acabó el fragmento» de una pausa del anfitrión", async () => {
    const { game, round, anaSeat } = await soloSetup();
    // La tele congela la ronda al acabarse el audio: 30 s de reloj gastados y pausada.
    await db.round.update({
      where: { id: round.id },
      data: { playStartedAt: new Date(Date.now() - 31_000), pausedAt: new Date(Date.now() - 500) },
    });
    expect(await fails(buzz(game.id, round.id, anaSeat))).toEqual({ code: "FRAGMENT_ENDED", status: 409 });

    // Una pausa a mitad del fragmento sigue siendo una pausa.
    await db.round.update({
      where: { id: round.id },
      data: { playStartedAt: new Date(Date.now() - 6_000), pausedAt: new Date(Date.now() - 500) },
    });
    expect(await fails(buzz(game.id, round.id, anaSeat))).toEqual({ code: "PAUSED", status: 409 });
  });

  it("quien tiene el turno bloquea a los demás con su nombre", async () => {
    const { game, round, anaSeat, luisSeat } = await soloSetup();
    await buzz(game.id, round.id, anaSeat);
    expect(await fails(buzz(game.id, round.id, luisSeat))).toEqual({ code: "BUZZ_TAKEN", status: 409 });
  });
});

describe("responder", () => {
  it("acertar el título gana la ronda, suma los puntos y queda como respuesta de móvil", async () => {
    const { game, round, ana, anaSeat } = await soloSetup();
    await buzz(game.id, round.id, anaSeat);
    const r = await answer(game.id, round.id, anaSeat, { title: "bailando", artist: "Enrique Iglesias" });

    expect(r).toMatchObject({ titleAwarded: true, artistAwarded: true, points: 4, lockedOut: false });
    expect(await score(ana.id)).toBe(4);
    expect(await reload(round.id)).toMatchObject({ status: "WON", winnerPlayerId: ana.id, buzzParticipantId: null });
    const [g] = await getRoundGuesses(game.id, round.id);
    expect(g).toMatchObject({ playerId: ana.id, titleCorrect: true, viaPhone: true, title: "bailando" });
  });

  it("fallar deja fuera a esa persona, reanuda el reloj sin gastar puntos y la canción sigue", async () => {
    const { game, round, anaSeat, luisSeat } = await soloSetup();
    await buzz(game.id, round.id, anaSeat);
    await new Promise((r) => setTimeout(r, 60));
    const r = await answer(game.id, round.id, anaSeat, { title: "otra canción" });
    expect(r).toMatchObject({ titleAwarded: false, lockedOut: true, points: 0 });

    const row = await reload(round.id);
    expect(row).toMatchObject({ status: "PLAYING", buzzParticipantId: null, pausedAt: null });
    expect(row.pausedMs).toBeGreaterThanOrEqual(50);
    expect(await isLockedOut(round.id, anaSeat)).toBe(true);
    expect(await fails(buzz(game.id, round.id, anaSeat))).toEqual({ code: "LOCKED_OUT", status: 409 });
    await expect(buzz(game.id, round.id, luisSeat)).resolves.toBeDefined();
  });

  it("acertar solo el artista deja el punto pero también fuera de la ronda", async () => {
    const { game, round, ana, anaSeat } = await soloSetup();
    await buzz(game.id, round.id, anaSeat);
    const r = await answer(game.id, round.id, anaSeat, { title: "nada", artist: "enrique iglesias" });
    expect(r).toMatchObject({ titleAwarded: false, artistAwarded: true, points: 1, lockedOut: true });
    expect(await score(ana.id)).toBe(1);
    expect((await reload(round.id)).status).toBe("PLAYING");
  });

  it("solo responde quien tiene el turno, y una sola vez", async () => {
    const { game, round, anaSeat, luisSeat } = await soloSetup();
    await buzz(game.id, round.id, anaSeat);
    expect(await fails(answer(game.id, round.id, luisSeat, { title: "Bailando" }))).toEqual({
      code: "NOT_YOUR_TURN",
      status: 409,
    });
    await answer(game.id, round.id, anaSeat, { title: "x" });
    expect(await fails(answer(game.id, round.id, anaSeat, { title: "Bailando" }))).toMatchObject({ code: "NOT_YOUR_TURN" });
  });

  it("con el ajuste «equipo», un fallo deja fuera a todo el equipo pero no al otro", async () => {
    const { game, round, ana, luis, marta } = await teamSetup("team");
    await buzz(game.id, round.id, ana);
    await answer(game.id, round.id, ana, { title: "mal" });
    expect(await fails(buzz(game.id, round.id, luis))).toMatchObject({ code: "LOCKED_OUT" });
    await expect(buzz(game.id, round.id, marta)).resolves.toBeDefined();
  });

  it("con el ajuste «persona», su compañero de equipo sí puede pulsar", async () => {
    const { game, round, ana, luis } = await teamSetup("person");
    await buzz(game.id, round.id, ana);
    await answer(game.id, round.id, ana, { title: "mal" });
    expect(await fails(buzz(game.id, round.id, ana))).toMatchObject({ code: "LOCKED_OUT" });
    await expect(buzz(game.id, round.id, luis)).resolves.toBeDefined();
  });

  it("los puntos de una respuesta por equipos van al equipo", async () => {
    const { game, round, tomates, ana } = await teamSetup("person");
    await buzz(game.id, round.id, ana);
    await answer(game.id, round.id, ana, { title: "Bailando" });
    expect(await score(tomates.id)).toBe(3);
  });
});

describe("tiempo agotado y la tele", () => {
  async function expired(opts: Awaited<ReturnType<typeof soloSetup>>) {
    await buzz(opts.game.id, opts.round.id, opts.anaSeat);
    await db.round.update({
      where: { id: opts.round.id },
      data: { buzzDeadline: new Date(Date.now() - BUZZ_GRACE_MS - 500) },
    });
  }

  it("una respuesta fuera de plazo da TIME_UP y cuenta como fallo", async () => {
    const s = await soloSetup();
    await expired(s);
    expect(await fails(answer(s.game.id, s.round.id, s.anaSeat, { title: "Bailando" }))).toEqual({
      code: "TIME_UP",
      status: 409,
    });
    expect(await isLockedOut(s.round.id, s.anaSeat)).toBe(true);
    expect(await reload(s.round.id)).toMatchObject({ status: "PLAYING", buzzParticipantId: null, pausedAt: null });
  });

  it("la tele cierra el turno solo cuando de verdad pasó el tiempo", async () => {
    const s = await soloSetup();
    await buzz(s.game.id, s.round.id, s.anaSeat);
    expect(await resolveBuzz(s.game.id, s.round.id, "expire")).toEqual({ settled: false });
    await db.round.update({
      where: { id: s.round.id },
      data: { buzzDeadline: new Date(Date.now() - BUZZ_GRACE_MS - 500) },
    });
    expect(await resolveBuzz(s.game.id, s.round.id, "expire")).toEqual({ settled: true });
    expect(await isLockedOut(s.round.id, s.anaSeat)).toBe(true);
    expect(await resolveBuzz(s.game.id, s.round.id, "expire")).toEqual({ settled: false });
  });

  it("quien llega tarde a pulsar encuentra el turno vencido ya cerrado", async () => {
    const s = await soloSetup();
    await expired(s);
    await expect(buzz(s.game.id, s.round.id, s.luisSeat)).resolves.toBeDefined();
    expect((await reload(s.round.id)).buzzParticipantId).toBe(s.luisSeat.id);
    expect(await isLockedOut(s.round.id, s.anaSeat)).toBe(true);
  });

  it("cancelar no deja fuera a nadie; fallar sí", async () => {
    const s = await soloSetup();
    await buzz(s.game.id, s.round.id, s.anaSeat);
    expect(await resolveBuzz(s.game.id, s.round.id, "cancel")).toEqual({ settled: true });
    expect(await isLockedOut(s.round.id, s.anaSeat)).toBe(false);
    expect((await reload(s.round.id)).pausedAt).toBeNull();

    await buzz(s.game.id, s.round.id, s.anaSeat);
    expect(await resolveBuzz(s.game.id, s.round.id, "fail")).toEqual({ settled: true });
    expect(await isLockedOut(s.round.id, s.anaSeat)).toBe(true);
  });

  it("si el anfitrión pulsa «Seguir» mientras alguien responde, le quita el turno", async () => {
    const s = await soloSetup();
    await buzz(s.game.id, s.round.id, s.anaSeat);
    await resumeRound(s.game.id, s.round.id);
    expect(await reload(s.round.id)).toMatchObject({ buzzParticipantId: null, pausedAt: null });
    expect(await isLockedOut(s.round.id, s.anaSeat)).toBe(false);
  });

  it("revelar la canción cierra también el turno", async () => {
    const s = await soloSetup();
    await buzz(s.game.id, s.round.id, s.anaSeat);
    const { revealRound } = await import("@/lib/game/service");
    await revealRound(s.game.id, s.round.id);
    expect(await reload(s.round.id)).toMatchObject({ status: "REVEALED", buzzParticipantId: null });
    expect((await getGame(s.game.id)).round!.buzz).toBeNull();
  });
});
