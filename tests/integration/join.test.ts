import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerMember } from "@/lib/access/accounts";
import { runCleanup } from "@/lib/access/admin";
import { registerGuest } from "@/lib/access/guest";
import { createInvite } from "@/lib/access/invites";
import type { Owner } from "@/lib/access/owner";
import { db } from "@/lib/db";
import {
  currentParticipant,
  JOIN_LIMITS,
  joinGame,
  kickParticipant,
  listParticipants,
  lookupGame,
  normalizeCode,
  setJoinOpen,
} from "@/lib/game/join";
import { createGame } from "@/lib/game/service";

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

const fails = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    return { code: (err as { code?: string }).code, status: (err as { status?: number }).status };
  }
  throw new Error("Se esperaba un error");
};

beforeEach(() => jar.clear());

async function newOwner(ip = "ip-host"): Promise<Owner> {
  const { guest } = await registerGuest(ip);
  return { kind: "guest", guestId: guest.id };
}

const soloGame = async () =>
  createGame({ mode: "open", rounds: 3, players: ["Ana", "Luis"] }, await newOwner());

const teamGame = async () =>
  createGame(
    {
      mode: "open",
      rounds: 3,
      format: "teams",
      maxTeamSize: 2,
      teams: [
        { name: "Tomates", color: "teja", members: ["Ana", "Luis"] },
        { name: "Cielo", color: "cielo", members: ["Marta"] },
      ],
    },
    await newOwner(),
  );

const ctx = (ip = "ip-join") => ({ ipHash: ip, user: null });

describe("el código", () => {
  it("se normaliza: mayúsculas y sin espacios ni guiones", () => {
    expect(normalizeCode("ab c-123")).toBe("ABC123");
    expect(normalizeCode(" x7k2 mp ")).toBe("X7K2MP");
  });

  it("un código que no existe da 404 y cuenta para el límite por IP", async () => {
    expect(await fails(lookupGame("ZZZZZZ", "ip-mala"))).toEqual({ code: "CODE_NOT_FOUND", status: 404 });
    for (let i = 0; i < JOIN_LIMITS.badCodesPerIp - 1; i++) await fails(lookupGame("ZZZZZZ", "ip-mala"));
    expect(await fails(lookupGame("ZZZZZZ", "ip-mala"))).toEqual({ code: "TOO_MANY_ATTEMPTS", status: 429 });
    // Otra IP no se ve afectada.
    expect(await fails(lookupGame("ZZZZZZ", "ip-buena"))).toEqual({ code: "CODE_NOT_FOUND", status: 404 });
  });

  it("una partida terminada ya no se puede abrir", async () => {
    const game = await soloGame();
    await db.game.update({ where: { id: game.id }, data: { status: "FINISHED" } });
    expect(await fails(lookupGame(game.code, "ip-x"))).toMatchObject({ code: "CODE_NOT_FOUND" });
  });

  it("lookup enseña formato, equipos con hueco y nombres sin reclamar", async () => {
    const game = await teamGame();
    const r = await lookupGame(game.code.toLowerCase(), "ip-x");
    expect(r).toMatchObject({ format: "teams", joinOpen: true, maxTeamSize: 2 });
    expect(r.teams.find((t) => t.name === "Tomates")).toMatchObject({ free: 0, members: ["Ana", "Luis"] });
    expect(r.teams.find((t) => t.name === "Cielo")).toMatchObject({ free: 1 });
    expect(r.pending.sort()).toEqual(["Ana", "Luis", "Marta"]);
  });
});

describe("unirse sin cuenta (todos contra todos)", () => {
  it("crea su jugador, guarda la cookie y se le reconoce después", async () => {
    const game = await soloGame();
    const joined = await joinGame({ code: game.code, name: "  Pablo  " }, ctx());
    expect(joined.name).toBe("Pablo");
    const me = await currentParticipant(game.id);
    expect(me).toMatchObject({ id: joined.participantId, playerId: joined.playerId });
    expect((await db.player.findMany({ where: { gameId: game.id } })).map((p) => p.name).sort()).toEqual([
      "Ana",
      "Luis",
      "Pablo",
    ]);
  });

  it("reclama el nombre que el anfitrión ya apuntó, una sola vez", async () => {
    const game = await soloGame();
    const first = await joinGame({ code: game.code, name: "ana" }, ctx());
    expect(first.name).toBe("Ana");
    expect((await db.player.count({ where: { gameId: game.id } })).valueOf()).toBe(2);
    jar.clear(); // otro dispositivo: sin la cookie de quien ya la reclamó
    expect(await fails(joinGame({ code: game.code, name: "Ana" }, ctx("ip-otro")))).toEqual({
      code: "NAME_TAKEN",
      status: 409,
    });
  });

  it("quien vuelve a entrar con su nombre desde el mismo navegador recupera su sitio", async () => {
    const game = await soloGame();
    const first = await joinGame({ code: game.code, name: "Pablo" }, ctx());
    const again = await joinGame({ code: game.code, name: "pablo" }, ctx());
    expect(again.participantId).toBe(first.participantId);
    expect(await db.participant.count({ where: { gameId: game.id } })).toBe(1);
    // Otro nombre desde el mismo navegador sí es otra persona.
    const other = await joinGame({ code: game.code, name: "Rosa" }, ctx());
    expect(other.participantId).not.toBe(first.participantId);
  });

  it("sin nombre da 422 y con la entrada cerrada, 403", async () => {
    const game = await soloGame();
    expect(await fails(joinGame({ code: game.code, name: " " }, ctx()))).toMatchObject({ code: "INVALID_NAME" });
    await setJoinOpen(game.id, false);
    expect(await fails(joinGame({ code: game.code, name: "Pablo" }, ctx()))).toEqual({ code: "JOIN_CLOSED", status: 403 });
    await setJoinOpen(game.id, true);
    await expect(joinGame({ code: game.code, name: "Pablo" }, ctx())).resolves.toMatchObject({ name: "Pablo" });
  });

  it("una cookie de otra partida no vale", async () => {
    const a = await soloGame();
    const b = await soloGame();
    await joinGame({ code: a.code, name: "Pablo" }, ctx());
    expect(await currentParticipant(a.id)).not.toBeNull();
    expect(await currentParticipant(b.id)).toBeNull();
  });

  it("el anfitrión puede echar a alguien y deja de estar dentro", async () => {
    const game = await soloGame();
    const joined = await joinGame({ code: game.code, name: "Pablo" }, ctx());
    expect(await listParticipants(game.id)).toMatchObject([{ name: "Pablo", hasAccount: false, team: null }]);
    await kickParticipant(game.id, joined.participantId);
    expect(await currentParticipant(game.id)).toBeNull();
    expect(await listParticipants(game.id)).toEqual([]);
    expect(await fails(kickParticipant(game.id, joined.participantId))).toMatchObject({ status: 404 });
  });
});

describe("unirse con cuenta", () => {
  async function member(username = "lucia") {
    const { code } = await createInvite(null);
    const user = await registerMember({ invite: code, username, password: "contraseña-segura" });
    return { id: user.id, displayName: user.displayName };
  }

  it("entra con el nombre de su cuenta, ligado a ella, y no se duplica al volver", async () => {
    const game = await soloGame();
    const user = await member();
    const first = await joinGame({ code: game.code }, { ipHash: "ip-1", user });
    expect(first.name).toBe(user.displayName);
    expect(await db.participant.findUniqueOrThrow({ where: { id: first.participantId } })).toMatchObject({ userId: user.id });

    jar.clear(); // otro navegador
    const again = await joinGame({ code: game.code }, { ipHash: "ip-2", user });
    expect(again.participantId).toBe(first.participantId);
    expect(await db.participant.count({ where: { gameId: game.id } })).toBe(1);
    expect(await currentParticipant(game.id)).toMatchObject({ id: first.participantId });
  });

  it("una cuenta echada no puede volver a entrar", async () => {
    const game = await soloGame();
    const user = await member("rosa");
    const joined = await joinGame({ code: game.code }, { ipHash: "ip-1", user });
    await kickParticipant(game.id, joined.participantId);
    expect(await fails(joinGame({ code: game.code }, { ipHash: "ip-1", user }))).toEqual({ code: "KICKED", status: 403 });
  });
});

describe("unirse por equipos", () => {
  it("elige equipo y entra como miembro nuevo", async () => {
    const game = await teamGame();
    const cielo = game.players.find((p) => p.name === "Cielo")!;
    const joined = await joinGame({ code: game.code, name: "Pablo", teamId: cielo.id }, ctx());
    expect(joined.playerId).toBe(cielo.id);
    const after = await db.player.findUniqueOrThrow({ where: { id: cielo.id }, include: { members: true } });
    expect(after.members.map((m) => m.name).sort()).toEqual(["Marta", "Pablo"]);
    expect(await listParticipants(game.id)).toMatchObject([{ name: "Pablo", team: { name: "Cielo", color: "cielo" } }]);
  });

  it("si el anfitrión ya lo apuntó, entra directo en su equipo sin elegir", async () => {
    const game = await teamGame();
    const tomates = game.players.find((p) => p.name === "Tomates")!;
    const joined = await joinGame({ code: game.code, name: "luis" }, ctx());
    expect(joined).toMatchObject({ name: "Luis", playerId: tomates.id });
    expect(await db.teamMember.count({ where: { playerId: tomates.id } })).toBe(2);
    jar.clear(); // otro dispositivo
    expect(await fails(joinGame({ code: game.code, name: "Luis" }, ctx("ip-2")))).toMatchObject({ code: "NAME_TAKEN" });
  });

  it("pide equipo si el nombre es nuevo y no deja entrar en uno lleno", async () => {
    const game = await teamGame();
    const tomates = game.players.find((p) => p.name === "Tomates")!;
    expect(await fails(joinGame({ code: game.code, name: "Pablo" }, ctx()))).toMatchObject({ code: "TEAM_REQUIRED" });
    expect(await fails(joinGame({ code: game.code, name: "Pablo", teamId: tomates.id }, ctx()))).toEqual({
      code: "TEAM_FULL",
      status: 409,
    });
    expect(await fails(joinGame({ code: game.code, name: "Pablo", teamId: "inventado" }, ctx()))).toMatchObject({
      code: "TEAM_REQUIRED",
    });
  });
});

describe("limpieza", () => {
  it("borra a los participantes de hace más de 7 días", async () => {
    const game = await soloGame();
    const joined = await joinGame({ code: game.code, name: "Pablo" }, ctx());
    await db.participant.update({
      where: { id: joined.participantId },
      data: { createdAt: new Date(Date.now() - 8 * 24 * 60 * 60_000) },
    });
    expect(await runCleanup()).toMatchObject({ participants: 1 });
    expect(await db.participant.count()).toBe(0);
  });
});
