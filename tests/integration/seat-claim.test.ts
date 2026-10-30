import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerGuest } from "@/lib/access/guest";
import type { Owner } from "@/lib/access/owner";
import { db } from "@/lib/db";
import { isLockedOut } from "@/lib/game/buzzer";
import {
  CLAIM_LIMITS,
  CLAIM_TTL_MS,
  claimStatus,
  currentParticipant,
  joinGame,
  kickParticipant,
  listParticipants,
  requestSeat,
  resolveClaim,
  setJoinOpen,
  withdrawClaim,
} from "@/lib/game/join";
import { createGame } from "@/lib/game/service";

// Dos navegadores, cada uno con su almacén de cookies: `as("b")` cambia de quién son las peticiones.
const jars: Record<string, Map<string, string>> = { a: new Map(), b: new Map(), c: new Map() };
let active = jars.a;
const as = (browser: "a" | "b" | "c") => void (active = jars[browser]);
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
  as("a");
});

const fails = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    return { code: (err as { code?: string }).code, status: (err as { status?: number }).status };
  }
  throw new Error("Se esperaba un error");
};

const ctx = (ip = "ip-claim") => ({ ipHash: ip, user: null });

async function newOwner(): Promise<Owner> {
  const { guest } = await registerGuest("ip-host");
  return { kind: "guest", guestId: guest.id };
}

/** Una partida con Pablo ya dentro desde el navegador A. */
async function gameWithPablo(format: "solo" | "teams" = "solo") {
  const owner = await newOwner();
  const game =
    format === "solo"
      ? await createGame({ mode: "open", rounds: 3, players: ["Ana", "Luis"] }, owner)
      : await createGame(
          {
            mode: "open",
            rounds: 3,
            format: "teams",
            maxTeamSize: 2,
            teams: [{ name: "Tomates", color: "teja", members: ["Pablo", "Ana"] }, { name: "Cielo", color: "cielo", members: ["Marta"] }],
          },
          owner,
        );
  as("a");
  const joined = await joinGame({ code: game.code, name: "Pablo" }, ctx("ip-a"));
  return { owner, game, pablo: joined.participantId };
}

describe("pedir entrar con el sitio de otro navegador", () => {
  it("crea una petición sobre el mismo participante, sin duplicarlo ni tocar el navegador viejo", async () => {
    const { game, pablo } = await gameWithPablo();

    as("b");
    const asked = await requestSeat({ code: game.code, name: "  pablo " }, ctx("ip-b"));

    expect(asked).toMatchObject({ gameId: game.id, name: "Pablo", already: false });
    expect(await db.participant.count({ where: { gameId: game.id } })).toBe(1);
    expect(jars.b.get(`c_${game.id}`)).toBeTruthy();
    expect(jars.b.has(`p_${game.id}`)).toBe(false);
    expect(await claimStatus(game.id)).toBe("pending");
    as("a");
    expect((await currentParticipant(game.id))?.id).toBe(pablo);
    expect((await listParticipants(game.id)).find((p) => p.id === pablo)?.claim).toBe(true);
  });

  it("si el anfitrión lo deja entrar, el navegador nuevo es ese sitio y el viejo sale", async () => {
    const { game, pablo } = await gameWithPablo();
    const before = await db.participant.findUniqueOrThrow({ where: { id: pablo } });
    as("b");
    await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-b"));

    await resolveClaim(game.id, pablo, true);

    expect(await claimStatus(game.id)).toBe("accepted");
    expect(jars.b.has(`c_${game.id}`)).toBe(false);
    const nowB = await currentParticipant(game.id);
    expect(nowB).toMatchObject({ id: pablo, playerId: before.playerId, name: "Pablo" });
    as("a");
    expect(await currentParticipant(game.id)).toBeNull();
    expect((await listParticipants(game.id)).find((p) => p.id === pablo)?.claim).toBe(false);
    expect(await db.gameEvent.count({ where: { type: "seat_reclaimed", gameId: game.id } })).toBe(1);
  });

  it("conserva el equipo y lo que ya había pasado en la ronda (quien falló sigue sin poder pulsar)", async () => {
    const { game, pablo } = await gameWithPablo("teams");
    const seat = await db.participant.findUniqueOrThrow({ where: { id: pablo } });
    const round = await db.round.create({
      data: { gameId: game.id, number: 1, trackId: "t1", trackUri: "itunes:t1", trackName: "Bailando", artists: "[]", durationMs: 30_000, startMs: 0 },
    });
    await db.roundLockout.create({ data: { roundId: round.id, participantId: pablo } });
    as("b");
    await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-b"));
    await resolveClaim(game.id, pablo, true);
    await claimStatus(game.id);

    const nowB = (await currentParticipant(game.id))!;

    expect(nowB).toMatchObject({ id: pablo, playerId: seat.playerId, memberId: seat.memberId });
    expect(await isLockedOut(round.id, nowB)).toBe(true);
  });

  it("si lo rechaza, no cambia nada y el que espera lo sabe", async () => {
    const { game, pablo } = await gameWithPablo();
    as("b");
    await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-b"));

    await resolveClaim(game.id, pablo, false);

    expect(await claimStatus(game.id)).toBe("gone");
    as("a");
    expect((await currentParticipant(game.id))?.id).toBe(pablo);
    expect((await listParticipants(game.id)).find((p) => p.id === pablo)?.claim).toBe(false);
  });

  it("la petición caduca a los 5 minutos y ya no se puede aceptar", async () => {
    const { game, pablo } = await gameWithPablo();
    as("b");
    await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-b"));
    const late = new Date(Date.now() + CLAIM_TTL_MS + 1_000);

    expect(await claimStatus(game.id, late)).toBe("gone");
    expect(await fails(resolveClaim(game.id, pablo, true, late))).toEqual({ code: "CLAIM_NOT_FOUND", status: 404 });
    as("a");
    expect((await currentParticipant(game.id))?.id).toBe(pablo);
  });

  it("una petición nueva sustituye a la anterior", async () => {
    const { game, pablo } = await gameWithPablo();
    as("b");
    await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-b"));
    as("c");
    await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-c"));

    await resolveClaim(game.id, pablo, true);

    as("b");
    expect(await claimStatus(game.id)).toBe("gone");
    as("c");
    expect(await claimStatus(game.id)).toBe("accepted");
  });

  it("quien espera puede retirar su petición", async () => {
    const { game, pablo } = await gameWithPablo();
    as("b");
    await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-b"));

    await withdrawClaim(game.id);

    expect(await claimStatus(game.id)).toBe("gone");
    expect(await fails(resolveClaim(game.id, pablo, true))).toMatchObject({ code: "CLAIM_NOT_FOUND" });
  });
});

describe("lo que no se puede pedir", () => {
  it("un nombre que nadie tiene dentro, o de alguien expulsado, no tiene sitio que recuperar", async () => {
    const { game, pablo } = await gameWithPablo();
    as("b");
    expect(await fails(requestSeat({ code: game.code, name: "Marta" }, ctx("ip-b")))).toEqual({ code: "CLAIM_NOT_FOUND", status: 404 });

    await kickParticipant(game.id, pablo);
    expect(await fails(requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-b")))).toMatchObject({ code: "CLAIM_NOT_FOUND" });
  });

  it("con la entrada cerrada se puede volver: no es entrar, es recuperar", async () => {
    const { game } = await gameWithPablo();
    await setJoinOpen(game.id, false);
    as("b");

    expect(await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-b"))).toMatchObject({ already: false });
  });

  it("quien ya es ese sitio en este navegador no genera ninguna petición", async () => {
    const { game, pablo } = await gameWithPablo();

    expect(await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-a"))).toMatchObject({ already: true });

    expect((await db.participant.findUniqueOrThrow({ where: { id: pablo } })).claimHash).toBeNull();
  });

  it("la cookie de la petición no pisa la de otro sitio que el navegador ya tuviera", async () => {
    const { game } = await gameWithPablo();
    as("b");
    await joinGame({ code: game.code, name: "Ana" }, ctx("ip-b"));
    const anaSeat = jars.b.get(`p_${game.id}`);

    await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-b"));

    expect(jars.b.get(`p_${game.id}`)).toBe(anaSeat);
    expect(jars.b.get(`c_${game.id}`)).toBeTruthy();
    expect((await currentParticipant(game.id))?.name).toBe("Ana");
  });

  it("pedir entrar muchas veces seguidas desde la misma conexión se frena", async () => {
    const { game } = await gameWithPablo();
    as("b");
    for (let i = 0; i < CLAIM_LIMITS.perIp; i++) await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-spam"));

    expect(await fails(requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-spam")))).toEqual({ code: "TOO_MANY_ATTEMPTS", status: 429 });
    // Otra conexión no se ve afectada.
    expect(await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-otra"))).toMatchObject({ already: false });
  });

  it("solo se resuelve una petición de esa partida, y sin petición no hay nada que resolver", async () => {
    const { game, pablo } = await gameWithPablo();
    const other = await gameWithPablo();
    as("b");
    await requestSeat({ code: game.code, name: "Pablo" }, ctx("ip-b"));

    expect(await fails(resolveClaim(other.game.id, pablo, true))).toMatchObject({ code: "CLAIM_NOT_FOUND" });
    expect(await fails(resolveClaim(other.game.id, other.pablo, true))).toMatchObject({ code: "CLAIM_NOT_FOUND" });
  });
});
