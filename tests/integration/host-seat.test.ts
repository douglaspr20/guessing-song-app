import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerGuest } from "@/lib/access/guest";
import type { Owner } from "@/lib/access/owner";
import { db } from "@/lib/db";
import { answer, buzz } from "@/lib/game/buzzer";
import { currentParticipant, joinGame, kickParticipant, leaveHostSeat, listParticipants, takeHostSeat } from "@/lib/game/join";
import { createGame } from "@/lib/game/service";

// Dos navegadores: «tele» (el del anfitrión) y «móvil», cada uno con sus cookies.
const jars: Record<string, Map<string, string>> = { tv: new Map(), phone: new Map() };
let active = jars.tv;
const as = (browser: "tv" | "phone") => void (active = jars[browser]);
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (active.has(name) ? { name, value: active.get(name)! } : undefined),
    set: (name: string, value: string) => void active.set(name, value),
    delete: (name: string) => void active.delete(name),
  }),
  headers: async () => new Headers(),
}));

beforeEach(() => {
  for (const jar of Object.values(jars)) jar.clear();
  as("tv");
});

const fails = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    return { code: (err as { code?: string }).code, status: (err as { status?: number }).status };
  }
  throw new Error("Se esperaba un error");
};

let n = 0;
async function newOwner(): Promise<Owner> {
  const { guest } = await registerGuest(`ip-host-seat-${n++}`);
  return { kind: "guest", guestId: guest.id };
}

const soloGame = async () => createGame({ mode: "open", rounds: 3, players: ["Ana", "Luis"] }, await newOwner());

describe("el anfitrión también juega", () => {
  it("ocupa uno de los nombres: este navegador pasa a ser ese participante, marcado como anfitrión", async () => {
    const game = await soloGame();

    const seat = await takeHostSeat(game.id, " ana ");

    expect(seat.name).toBe("Ana");
    const me = await currentParticipant(game.id);
    expect(me).toMatchObject({ name: "Ana", isHost: true, playerId: game.players.find((p) => p.name === "Ana")!.id });
    expect((await listParticipants(game.id)).map((p) => [p.name, p.host])).toEqual([["Ana", true]]);
  });

  it("por equipos ocupa el sitio del miembro, en su equipo", async () => {
    const game = await createGame(
      {
        mode: "open",
        rounds: 2,
        format: "teams",
        maxTeamSize: 2,
        teams: [
          { name: "Tomates", color: "teja", members: ["Ana", "Luis"] },
          { name: "Cielo", color: "cielo", members: ["Marta"] },
        ],
      },
      await newOwner(),
    );

    await takeHostSeat(game.id, "Marta");

    const me = (await currentParticipant(game.id))!;
    expect(me.playerId).toBe(game.players.find((p) => p.name === "Cielo")!.id);
    expect(me.memberId).toBeTruthy();
  });

  it("puede cambiar de nombre o dejar de jugar antes de empezar, sin dejar sitios sueltos", async () => {
    const game = await soloGame();
    await takeHostSeat(game.id, "Ana");
    await takeHostSeat(game.id, "Luis");

    expect((await listParticipants(game.id)).map((p) => p.name)).toEqual(["Luis"]);

    await leaveHostSeat(game.id);
    expect(await listParticipants(game.id)).toEqual([]);
    expect(await currentParticipant(game.id)).toBeNull();
  });

  it("solo con los nombres de la partida y si nadie lo tiene ya desde su móvil", async () => {
    const game = await soloGame();
    expect(await fails(takeHostSeat(game.id, "Marta"))).toEqual({ code: "HOST_NAME_NOT_FOUND", status: 404 });

    as("phone");
    await joinGame({ code: game.code, name: "Ana" }, { ipHash: "ip-phone", user: null });
    as("tv");
    expect(await fails(takeHostSeat(game.id, "Ana"))).toEqual({ code: "NAME_TAKEN", status: 409 });
  });

  it("una vez empezada la partida ya no se cambia", async () => {
    const game = await soloGame();
    await takeHostSeat(game.id, "Ana");
    await db.game.update({ where: { id: game.id }, data: { status: "PLAYING", currentRound: 1 } });

    expect(await fails(takeHostSeat(game.id, "Luis"))).toMatchObject({ code: "GAME_ALREADY_STARTED" });
    expect(await fails(leaveHostSeat(game.id))).toMatchObject({ code: "GAME_ALREADY_STARTED" });
  });

  it("no se puede sacar al anfitrión desde la lista", async () => {
    const game = await soloGame();
    const { participantId } = await takeHostSeat(game.id, "Ana");

    expect(await fails(kickParticipant(game.id, participantId))).toEqual({ code: "CANT_KICK_HOST", status: 409 });
  });

  it("pulsa y responde como cualquier móvil: lo juzga el servidor y suma a su jugador", async () => {
    const game = await soloGame();
    await takeHostSeat(game.id, "Ana");
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
        playStartedAt: new Date(Date.now() - 1_000),
      },
    });
    const me = (await currentParticipant(game.id))!;

    await buzz(game.id, round.id, me);
    const result = await answer(game.id, round.id, me, { title: "bailando" });

    expect(result).toMatchObject({ titleAwarded: true, points: 3 });
    expect((await db.player.findUniqueOrThrow({ where: { id: me.playerId } })).score).toBe(3);
  });
});

describe("al grabar la partida", () => {
  it("el nombre con el que juega el anfitrión tiene que ser uno de los de la partida", async () => {
    await expect(
      createGame({ mode: "open", rounds: 2, players: ["Ana"], hostPlaysAs: "Marta" }, await newOwner()),
    ).rejects.toThrow(/Elige con cuál de los nombres/);
  });
});
