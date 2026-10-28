import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerGuest } from "@/lib/access/guest";
import type { Owner } from "@/lib/access/owner";
import { db } from "@/lib/db";
import { createGame, replayGame } from "@/lib/game/service";
import { getSharedResult, isShareToken, shareAndDescribe, shareGame, unshareGame } from "@/lib/game/share";

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

const fails = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    return { code: (err as { code?: string }).code, status: (err as { status?: number }).status };
  }
  throw new Error("Se esperaba un error");
};

async function newOwner(): Promise<Owner> {
  const { guest } = await registerGuest("ip-share");
  return { kind: "guest", guestId: guest.id };
}

/** Una partida terminada: Ana 9, Luis 6, Marta 2, con filtros y código de unirse que NO deben salir al compartir. */
async function finishedGame() {
  const owner = await newOwner();
  const game = await createGame(
    {
      mode: "open",
      rounds: 5,
      players: ["Ana", "Luis", "Marta"],
      filters: { source: "search", genres: ["rock"], playlistIds: [], keywords: "bolero secreto" },
    },
    owner,
  );
  const scores = { Ana: 9, Luis: 6, Marta: 2 } as const;
  for (const p of game.players) await db.player.update({ where: { id: p.id }, data: { score: scores[p.name as keyof typeof scores] } });
  await db.game.update({ where: { id: game.id }, data: { status: "FINISHED" } });
  return { owner, game };
}

describe("compartir el resultado", () => {
  it("solo se comparte una partida terminada", async () => {
    const owner = await newOwner();
    const game = await createGame({ mode: "open", rounds: 3, players: ["Ana"] }, owner);

    expect(await fails(shareGame(game.id, "es"))).toEqual({ code: "GAME_NOT_FINISHED", status: 409 });
    expect(await fails(shareGame("no-existe", "es"))).toEqual({ code: "GAME_NOT_FOUND", status: 404 });
  });

  it("el código es largo, aleatorio y el segundo clic devuelve el mismo", async () => {
    const { game } = await finishedGame();

    const first = await shareGame(game.id, "es");
    const again = await shareGame(game.id, "en");

    expect(isShareToken(first.token)).toBe(true);
    expect(again.token).toBe(first.token);
    // El idioma que vale es el de quien compartió primero.
    expect((await getSharedResult(first.token))!.locale).toBe("es");
    const other = await finishedGame();
    expect((await shareGame(other.game.id, "es")).token).not.toBe(first.token);
  });

  it("dos clics a la vez crean un solo código y un solo evento", async () => {
    const { game } = await finishedGame();

    const [a, b] = await Promise.all([shareGame(game.id, "es"), shareGame(game.id, "es")]);

    expect(b.token).toBe(a.token);
    expect(await db.gameEvent.count({ where: { type: "result_shared", gameId: game.id } })).toBe(1);
    await shareGame(game.id, "es");
    expect(await db.gameEvent.count({ where: { type: "result_shared" } })).toBe(1);
  });

  it("lo público son nombres, puntos, puestos, número de casete y pistas, y nada más", async () => {
    const { game } = await finishedGame();
    const { token } = await shareGame(game.id, "en");

    const result = (await getSharedResult(token))!;

    expect(result).toMatchObject({ locale: "en", catalogNumber: 1, totalRounds: 5 });
    expect(result.players.map((p) => [p.place, p.name, p.score])).toEqual([[1, "Ana", 9], [2, "Luis", 6], [3, "Marta", 2]]);
    const dump = JSON.stringify(result);
    for (const secret of [game.code, "bolero secreto", "rock", game.id, ...game.players.map((p) => p.id)]) {
      expect(dump).not.toContain(secret);
    }
  });

  it("por equipos devuelve los miembros", async () => {
    const owner = await newOwner();
    const game = await createGame(
      {
        mode: "open",
        rounds: 3,
        format: "teams",
        maxTeamSize: 2,
        teams: [{ name: "Tomates", color: "teja", members: ["Ana", "Luis"] }, { name: "Cielo", color: "cielo", members: ["Marta"] }],
      },
      owner,
    );
    await db.player.update({ where: { id: game.players.find((p) => p.name === "Tomates")!.id }, data: { score: 5 } });
    await db.game.update({ where: { id: game.id }, data: { status: "FINISHED" } });

    const { token } = await shareGame(game.id, "es");

    expect((await getSharedResult(token))!.players[0]).toMatchObject({ name: "Tomates", color: "teja", members: ["Ana", "Luis"] });
  });

  it("dejar de compartir mata el enlace; se puede volver a compartir con otro código", async () => {
    const { game } = await finishedGame();
    const { token } = await shareGame(game.id, "es");

    await unshareGame(game.id);

    expect(await getSharedResult(token)).toBeNull();
    const fresh = await shareGame(game.id, "es");
    expect(fresh.token).not.toBe(token);
    expect(await getSharedResult(fresh.token)).not.toBeNull();
  });

  it("un código inventado, mal formado o de una partida borrada no da nada", async () => {
    const { game } = await finishedGame();
    const { token } = await shareGame(game.id, "es");

    expect(await getSharedResult("corto")).toBeNull();
    expect(await getSharedResult("A".repeat(16))).toBeNull();
    expect(await getSharedResult("../../etc/passwd!!")).toBeNull();
    await db.game.delete({ where: { id: game.id } });
    expect(await getSharedResult(token)).toBeNull();
  });

  it("si la partida deja de estar terminada, el enlace no enseña nada", async () => {
    const { game } = await finishedGame();
    const { token } = await shareGame(game.id, "es");
    await db.game.update({ where: { id: game.id }, data: { status: "PLAYING" } });

    expect(await getSharedResult(token)).toBeNull();
  });

  it("devuelve el titular para el texto de «Compartir…»", async () => {
    const { game } = await finishedGame();

    expect(await shareAndDescribe(game.id, "es")).toMatchObject({ headline: "Ganó Ana", cat: "C-001" });
    expect((await shareAndDescribe(game.id, "en")).headline).toBe("Winner: Ana");
  });

  it("una partida «Otra igual» nace sin enlace aunque la anterior se compartiera", async () => {
    const { owner, game } = await finishedGame();
    await shareGame(game.id, "es");

    const next = await replayGame(game.id, owner);

    expect((await db.game.findUniqueOrThrow({ where: { id: next.id } })).shareToken).toBeNull();
  });
});
