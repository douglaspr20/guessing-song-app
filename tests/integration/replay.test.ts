import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerGuest } from "@/lib/access/guest";
import type { Owner } from "@/lib/access/owner";
import { db } from "@/lib/db";
import { currentParticipant, followNextGame, joinGame, kickParticipant } from "@/lib/game/join";
import { awardSpoken, createGame, getGame, replayGame } from "@/lib/game/service";

// Fuera de una petición de Next no hay cookies: se simulan con un almacén en memoria.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers(),
}));

beforeEach(() => jar.clear());

const code = (err: unknown) => (err as { code?: string }).code;
const fails = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    return { code: code(err), status: (err as { status?: number }).status };
  }
  throw new Error("Se esperaba un error");
};

const ctx = () => ({ ipHash: "ip-replay", user: null });
const finish = (gameId: string) => db.game.update({ where: { id: gameId }, data: { status: "FINISHED" } });
const events = (type: string) => db.gameEvent.findMany({ where: { type }, orderBy: { createdAt: "asc" } });

async function newOwner(): Promise<Owner> {
  const { guest } = await registerGuest("ip-host");
  return { kind: "guest", guestId: guest.id };
}
const guestIdOf = (owner: Owner) => (owner as { guestId: string }).guestId;

const soloGame = async (owner: Owner) =>
  createGame(
    {
      mode: "open",
      rounds: 4,
      players: ["Ana", "Luis"],
      answerSeconds: 30,
      filters: { source: "search", genres: ["rock"], playlistIds: [], keywords: "bolero" },
    },
    owner,
  );

const teamGame = async (owner: Owner) =>
  createGame(
    {
      mode: "open",
      rounds: 3,
      format: "teams",
      maxTeamSize: 2,
      lockout: "team",
      teams: [
        { name: "Tomates", color: "teja", members: ["Ana", "Luis"] },
        { name: "Cielo", color: "cielo", members: ["Marta"] },
      ],
    },
    owner,
  );

describe("«Otra igual»", () => {
  it("copia ajustes, filtros y jugadores, también el que entró desde el móvil", async () => {
    const owner = await newOwner();
    const old = await soloGame(owner);
    await joinGame({ code: old.code, name: "Pablo" }, ctx());
    await finish(old.id);

    const next = await replayGame(old.id, owner);

    expect(next.id).not.toBe(old.id);
    expect(next.code).not.toBe(old.code);
    expect(next).toMatchObject({ status: "LOBBY", mode: "open", format: "solo", totalRounds: 4, answerSeconds: 30 });
    expect(next.filters).toMatchObject({ genres: ["rock"], keywords: "bolero" });
    expect(next.players.map((p) => p.name).sort()).toEqual(["Ana", "Luis", "Pablo"]);
    expect(next.players.every((p) => p.score === 0)).toBe(true);
    expect((await getGame(old.id)).nextGameId).toBe(next.id);
  });

  it("por equipos conserva nombres, colores y miembros", async () => {
    const owner = await newOwner();
    const old = await teamGame(owner);
    await finish(old.id);

    const next = await replayGame(old.id, owner);

    expect(next).toMatchObject({ format: "teams", maxTeamSize: 2, lockout: "team" });
    const tomates = next.players.find((p) => p.name === "Tomates")!;
    expect(tomates.color).toBe("teja");
    expect([...tomates.members].sort()).toEqual(["Ana", "Luis"]);
    expect(next.players.find((p) => p.name === "Cielo")!.members).toEqual(["Marta"]);
  });

  it("solo se repite una partida terminada, y un segundo clic devuelve la misma", async () => {
    const owner = await newOwner();
    const old = await soloGame(owner);
    expect(await fails(replayGame(old.id, owner))).toEqual({ code: "GAME_NOT_FINISHED", status: 409 });

    await finish(old.id);
    const [a, b] = [await replayGame(old.id, owner), await replayGame(old.id, owner)];
    expect(b.id).toBe(a.id);
    expect(await db.game.count({ where: { guestId: guestIdOf(owner) } })).toBe(2);
  });

  it("dos clics a la vez no crean dos partidas", async () => {
    const owner = await newOwner();
    const old = await soloGame(owner);
    await finish(old.id);

    const [a, b] = await Promise.all([replayGame(old.id, owner), replayGame(old.id, owner)]);

    expect(b.id).toBe(a.id);
    expect(await db.game.count({ where: { guestId: guestIdOf(owner) } })).toBe(2);
  });

  it("si se borra la nueva (p. ej. al editarla), se puede grabar otra", async () => {
    const owner = await newOwner();
    const old = await soloGame(owner);
    await finish(old.id);
    const first = await replayGame(old.id, owner);
    await db.game.delete({ where: { id: first.id } });

    expect((await getGame(old.id)).nextGameId).toBeNull();
    const second = await replayGame(old.id, owner);
    expect(second.id).not.toBe(first.id);
  });
});

describe("los móviles siguen a la nueva partida", () => {
  it("pasa a la nueva con el mismo nombre (todos contra todos)", async () => {
    const owner = await newOwner();
    const old = await soloGame(owner);
    const joined = await joinGame({ code: old.code, name: "Pablo" }, ctx());
    await finish(old.id);
    const next = await replayGame(old.id, owner);

    const followed = await followNextGame(old.id, ctx());

    expect(followed).toMatchObject({ gameId: next.id, name: "Pablo" });
    expect(followed.participantId).not.toBe(joined.participantId);
    const mine = await currentParticipant(next.id);
    expect(mine).toMatchObject({ name: "Pablo" });
    expect(next.players.find((p) => p.id === mine!.playerId)!.name).toBe("Pablo");
  });

  it("por equipos se sienta en su mismo equipo", async () => {
    const owner = await newOwner();
    const old = await teamGame(owner);
    await joinGame({ code: old.code, name: "Marta" }, ctx());
    await finish(old.id);
    const next = await replayGame(old.id, owner);

    await followNextGame(old.id, ctx());

    const mine = (await currentParticipant(next.id))!;
    expect(next.players.find((p) => p.id === mine.playerId)!.name).toBe("Cielo");
    expect(mine.memberId).not.toBeNull();
  });

  it("antes de «Otra igual» no hay a dónde ir, y quien fue expulsado no sigue", async () => {
    const owner = await newOwner();
    const old = await soloGame(owner);
    const joined = await joinGame({ code: old.code, name: "Pablo" }, ctx());
    await finish(old.id);
    expect(await fails(followNextGame(old.id, ctx()))).toEqual({ code: "NO_NEXT_GAME", status: 404 });

    await replayGame(old.id, owner);
    await kickParticipant(old.id, joined.participantId);
    expect(await fails(followNextGame(old.id, ctx()))).toMatchObject({ status: 404 });
  });
});

describe("analítica de la partida", () => {
  it("anota la creación, los móviles, «Otra igual» y el final, sin datos personales", async () => {
    const owner = await newOwner();
    const old = await soloGame(owner);
    await joinGame({ code: old.code, name: "Pablo" }, ctx());
    expect(await events("game_created")).toMatchObject([
      { gameId: old.id, mode: "open", format: "solo", ownerKind: "guest", replay: false },
    ]);
    expect(await events("phone_joined")).toHaveLength(1);

    // Una partida de una sola ronda: acertarla la termina.
    const short = await createGame({ mode: "open", rounds: 1, players: ["Ana"] }, owner);
    await db.game.update({ where: { id: short.id }, data: { status: "PLAYING", currentRound: 1 } });
    const round = await db.round.create({
      data: {
        gameId: short.id,
        number: 1,
        trackId: "t1",
        trackUri: "itunes:t1",
        trackName: "Bailando",
        artists: JSON.stringify(["Enrique Iglesias"]),
        durationMs: 30_000,
        startMs: 0,
        playStartedAt: new Date(Date.now() - 1_000),
      },
    });
    await awardSpoken(short.id, round.id, short.players[0].id, { title: true });
    expect(await events("game_finished")).toMatchObject([{ gameId: short.id, mode: "open", ownerKind: "guest" }]);

    await replayGame(short.id, owner);
    const created = await events("game_created");
    expect(created.map((e) => e.replay)).toEqual([false, false, true]);

    // Nada que identifique a alguien: ni nombres ni IP en las filas.
    const rows = JSON.stringify(await db.gameEvent.findMany());
    for (const secret of ["Pablo", "ip-replay", "ip-host"]) expect(rows).not.toContain(secret);
  });

  it("un móvil que sigue cuenta como «siguió», no como unido", async () => {
    const owner = await newOwner();
    const old = await soloGame(owner);
    await joinGame({ code: old.code, name: "Pablo" }, ctx());
    await finish(old.id);
    await replayGame(old.id, owner);
    await followNextGame(old.id, ctx());

    expect(await events("phone_joined")).toHaveLength(1);
    expect(await events("phone_followed")).toHaveLength(1);
  });
});
