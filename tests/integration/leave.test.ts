import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerGuest } from "@/lib/access/guest";
import type { Owner } from "@/lib/access/owner";
import { db } from "@/lib/db";
import { currentParticipant, joinGame, leaveGame, lookupGame, takeHostSeat } from "@/lib/game/join";
import { createGame } from "@/lib/game/service";

// Dos navegadores: «tele» (el del anfitrión) y «móvil», cada uno con sus cookies.
const jars: Record<string, Map<string, string>> = { tv: new Map(), phone: new Map() };
let active = jars.tv;
const as = (browser: "tv" | "phone") => void (active = jars[browser]);
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (active.has(name) ? { name, value: active.get(name)! } : undefined),
    set: (name: string, value: string, opts?: { maxAge?: number }) => void (opts?.maxAge === 0 ? active.delete(name) : active.set(name, value)),
    delete: (name: string) => void active.delete(name),
  }),
  headers: async () => new Headers(),
}));

beforeEach(() => {
  for (const jar of Object.values(jars)) jar.clear();
  as("phone");
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
  const { guest } = await registerGuest(`ip-leave-${n++}`);
  return { kind: "guest", guestId: guest.id };
}

const ctx = { ipHash: "ip-leave-phone", user: null };
const soloGame = async () => createGame({ mode: "open", rounds: 3, players: ["Ana", "Luis"] }, await newOwner());
const playerNames = async (gameId: string) =>
  (await db.player.findMany({ where: { gameId }, orderBy: { name: "asc" } })).map((p) => p.name);

describe("salirse de la partida antes de que empiece", () => {
  it("quien entró con un nombre nuevo desaparece con él: ni en la sala ni en el marcador", async () => {
    const game = await soloGame();
    await joinGame({ code: game.code, name: "Pablo" }, ctx);
    expect(await playerNames(game.id)).toEqual(["Ana", "Luis", "Pablo"]);

    await leaveGame(game.id);

    expect(await playerNames(game.id)).toEqual(["Ana", "Luis"]);
    expect(await db.participant.count({ where: { gameId: game.id } })).toBe(0);
    expect(await currentParticipant(game.id)).toBeNull();
    // Puede volver a entrar con el código, como la primera vez.
    await joinGame({ code: game.code, name: "Pablo" }, ctx);
    expect(await playerNames(game.id)).toEqual(["Ana", "Luis", "Pablo"]);
  });

  it("un nombre que apuntó el anfitrión se queda en la partida, libre para quien lo reclame", async () => {
    const game = await soloGame();
    await joinGame({ code: game.code, name: "Ana" }, ctx);
    expect((await lookupGame(game.code, ctx.ipHash)).pending).toEqual(["Luis"]);

    await leaveGame(game.id);

    expect(await playerNames(game.id)).toEqual(["Ana", "Luis"]);
    expect((await lookupGame(game.code, ctx.ipHash)).pending).toEqual(["Ana", "Luis"]);
  });

  it("por equipos se quita su sitio y el equipo se queda", async () => {
    const game = await createGame(
      {
        mode: "open",
        rounds: 2,
        format: "teams",
        maxTeamSize: 3,
        teams: [
          { name: "Tomates", color: "teja", members: ["Ana"] },
          { name: "Cielo", color: "cielo", members: ["Marta"] },
        ],
      },
      await newOwner(),
    );
    const cielo = game.players.find((p) => p.name === "Cielo")!;
    await joinGame({ code: game.code, name: "Pablo", teamId: cielo.id }, ctx);

    await leaveGame(game.id);

    const members = await db.teamMember.findMany({ where: { playerId: cielo.id } });
    expect(members.map((m) => m.name)).toEqual(["Marta"]);
    expect(await playerNames(game.id)).toEqual(["Cielo", "Tomates"]);
  });

  it("con la partida empezada ya no se puede (409)", async () => {
    const game = await soloGame();
    await joinGame({ code: game.code, name: "Pablo" }, ctx);
    await db.game.update({ where: { id: game.id }, data: { status: "PLAYING", currentRound: 1 } });

    expect(await fails(leaveGame(game.id))).toEqual({ code: "GAME_ALREADY_STARTED", status: 409 });
    expect(await playerNames(game.id)).toContain("Pablo");
  });

  it("el anfitrión que juega no se sale por aquí (tiene su «Dejar de jugar»), y sin cookie es 404", async () => {
    const game = await soloGame();
    as("tv");
    await takeHostSeat(game.id, "Ana");
    expect(await fails(leaveGame(game.id))).toEqual({ code: "CANT_LEAVE_AS_HOST", status: 409 });

    as("phone");
    expect((await fails(leaveGame(game.id))).status).toBe(404);
  });
});
