import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { authenticateMember, MEMBER_LOCK, redeemInvite, registerMember } from "@/lib/access/accounts";
import { blockIp, deleteAllGuests, deleteMemberGames, runCleanup, setMemberSpotify } from "@/lib/access/admin";
import { signInWithGoogle } from "@/lib/access/google";
import { guestForToken, registerGuest } from "@/lib/access/guest";
import { authenticateHost } from "@/lib/access/host";
import { createInvite } from "@/lib/access/invites";
import {
  assertGuestCanCreateGame,
  assertGuestCanStartRound,
  assertOwnerCanCreateGame,
  GUEST_LIMITS,
} from "@/lib/access/limits";
import { assertOwnsGame, type Owner } from "@/lib/access/owner";
import { hashPassword } from "@/lib/access/password";
import { changePassword, resetMemberPassword, temporaryPassword } from "@/lib/access/passwords";
import { openSession, userForSessionToken } from "@/lib/access/session";
import { setAppFlags } from "@/lib/access/state";
import { LOGIN_LIMITS } from "@/lib/access/throttle";
import { base32Encode, hotp, totpCounter } from "@/lib/access/totp";
import { sha256 } from "@/lib/access/hash";
import { db } from "@/lib/db";
import { createGame, deleteAllGames, getGame, listGames } from "@/lib/game/service";

const openGame = (owner: Owner) => createGame({ mode: "open", rounds: 3, players: ["Ana", "Luis"] }, owner);

async function newGuest(ip = "ip-a") {
  const { token, guest } = await registerGuest(ip);
  return { token, owner: { kind: "guest", guestId: guest.id } as Owner };
}

async function newMember(username = "lucia", password = "contraseña-segura") {
  const { code } = await createInvite(null);
  const user = await registerMember({ invite: code, username, password });
  return { user, owner: { kind: "user", userId: user.id, role: "member", spotifyAllowed: true } as Owner };
}

const code = (err: unknown) => (err as { code?: string }).code;
const fails = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    return { code: code(err), status: (err as { status?: number }).status };
  }
  throw new Error("Se esperaba un error");
};

describe("cada dueño ve solo lo suyo", () => {
  it("un invitado no ve ni toca las partidas de otro (404)", async () => {
    const a = await newGuest("ip-a");
    const b = await newGuest("ip-b");
    const game = await openGame(a.owner);

    await expect(assertOwnsGame(a.owner, game.id)).resolves.toBeUndefined();
    expect(await fails(assertOwnsGame(b.owner, game.id))).toEqual({ code: "GAME_NOT_FOUND", status: 404 });
    expect((await listGames(a.owner)).total).toBe(1);
    expect(await listGames(b.owner)).toEqual({ total: 0, games: [] });
  });

  it("miembros e invitados tienen estanterías separadas y numeradas desde C-001", async () => {
    const guest = await newGuest();
    const { owner: member } = await newMember();
    await openGame(guest.owner);
    await openGame(guest.owner);
    const mine = await openGame(member);

    expect(mine.catalogNumber).toBe(1);
    expect((await getGame(mine.id)).catalogNumber).toBe(1);
    expect((await listGames(member)).games.map((g) => g.id)).toEqual([mine.id]);
    expect(await fails(assertOwnsGame(guest.owner, mine.id))).toMatchObject({ status: 404 });
  });

  it("un invitado no puede usar Spotify y un miembro necesita vincularlo", async () => {
    const guest = await newGuest();
    const { owner: member } = await newMember();
    const spotifyGame = { mode: "spotify" as const, rounds: 3, players: ["Ana"], fragmentSeconds: 60 };

    expect(await fails(createGame(spotifyGame, guest.owner))).toMatchObject({ status: 404 });
    expect(await fails(createGame(spotifyGame, member))).toMatchObject({ code: "SPOTIFY_NOT_LINKED" });
  });

  it("la base de datos exige exactamente un dueño por partida", async () => {
    await expect(
      db.game.create({ data: { code: "SINDUE", totalRounds: 1, fragmentSeconds: 30, filters: "{}" } }),
    ).rejects.toThrow();
  });
});

describe("invitaciones y miembros", () => {
  it("sin invitación válida no hay registro, y cada código sirve una vez", async () => {
    expect(await fails(registerMember({ invite: "NOEX-ISTE-0000", username: "pepe", password: "12345678" }))).toMatchObject({
      code: "INVALID_INVITE",
    });

    const { code: invite } = await createInvite("para pepe");
    // Sin guiones y en minúsculas también vale.
    const user = await registerMember({ invite: invite.replace(/-/g, "").toLowerCase(), username: "Pepe", password: "12345678" });
    expect(user.username).toBe("pepe");
    expect(await fails(registerMember({ invite, username: "otro", password: "12345678" }))).toMatchObject({
      code: "INVALID_INVITE",
    });
  });

  it("una invitación caducada no sirve y los nombres reservados tampoco", async () => {
    const old = await createInvite(null, new Date(Date.now() - 8 * 24 * 60 * 60_000));
    expect(await fails(registerMember({ invite: old.code, username: "tarde", password: "12345678" }))).toMatchObject({
      code: "INVALID_INVITE",
    });
    const fresh = await createInvite(null);
    expect(await fails(registerMember({ invite: fresh.code, username: "anfitrion", password: "12345678" }))).toMatchObject({
      code: "USERNAME_TAKEN",
    });
  });

  it("bloquea la cuenta tras varios fallos seguidos, aunque luego acierte", async () => {
    await newMember("marta", "la-buena-de-verdad");
    for (let i = 0; i < MEMBER_LOCK.failures; i++) {
      // Una IP distinta en cada intento: así salta el bloqueo de la cuenta, no el de la IP.
      await expect(authenticateMember("marta", "mala", `ip-${i}`)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }
    await expect(authenticateMember("marta", "la-buena-de-verdad", "ip-otra")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("frena a una IP que acumula fallos (429), sin decir si el usuario existe", async () => {
    await newMember("ines", "la-buena-de-verdad");
    for (let i = 0; i < LOGIN_LIMITS.perIp; i++) {
      await expect(authenticateMember(`nadie${i}`, "x", "ip-mala")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }
    await expect(authenticateMember("ines", "la-buena-de-verdad", "ip-mala")).rejects.toMatchObject({
      code: "TOO_MANY_ATTEMPTS",
      status: 429,
    });
    await expect(authenticateMember("ines", "la-buena-de-verdad", "ip-buena")).resolves.toMatchObject({ username: "ines" });
  });
});

describe("anfitrión", () => {
  const totpKey = randomBytes(20);
  beforeEach(async () => {
    process.env.HOST_PASSWORD_HASH = await hashPassword("frase larga del anfitrión");
    process.env.HOST_TOTP_SECRET = base32Encode(totpKey);
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });

  it("necesita contraseña y código, y el mismo código no sirve dos veces", async () => {
    const now = new Date();
    const valid = hotp(totpKey, totpCounter(now.getTime()));

    await expect(authenticateHost("otra cosa", valid, "ip-h", now)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(authenticateHost("frase larga del anfitrión", "000000", "ip-h", now)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    const host = await authenticateHost("frase larga del anfitrión", valid, "ip-h", now);
    expect(host).toMatchObject({ id: "host", role: "host" });
    await expect(authenticateHost("frase larga del anfitrión", valid, "ip-h", now)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("sin secretos configurados nadie entra", async () => {
    delete process.env.HOST_TOTP_SECRET;
    const now = new Date();
    await expect(
      authenticateHost("frase larga del anfitrión", hotp(totpKey, totpCounter(now.getTime())), "ip-h", now),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});

describe("sesiones", () => {
  it("la cookie da el usuario; caducada o con el usuario desactivado, no", async () => {
    const { user } = await newMember();
    const token = await openSession(user.id, "test");
    expect(await userForSessionToken(token)).toMatchObject({ id: user.id, role: "member" });
    // En la base de datos solo está el hash del token.
    expect(await db.session.findFirst({ where: { id: token } })).toBeNull();

    expect(await userForSessionToken(token, new Date(Date.now() + 8 * 24 * 60 * 60_000))).toBeNull();
    await db.user.update({ where: { id: user.id }, data: { disabledAt: new Date() } });
    expect(await userForSessionToken(token)).toBeNull();
  });
});

describe("entrar con Google y el permiso de Spotify", () => {
  const ana = { sub: "google-ana", email: "ana.perez@gmail.com", name: "Ana Pérez" };
  const freeOwner = (userId: string) => ({ kind: "user", userId, role: "member", spotifyAllowed: false }) as Owner;

  it("crea una cuenta gratis y la reconoce al volver", async () => {
    const first = await signInWithGoogle(ana, null);
    expect(first).toMatchObject({ created: true, linked: false });
    expect(first.user).toMatchObject({ username: "ana.perez", displayName: "Ana Pérez", spotifyAllowed: false, passwordHash: null });

    const again = await signInWithGoogle(ana, null);
    expect(again).toMatchObject({ created: false });
    expect(again.user.id).toBe(first.user.id);
    expect(await db.user.count()).toBe(1);
  });

  it("no une cuentas por coincidir el correo y da un usuario libre", async () => {
    await registerMember({ invite: (await createInvite(null)).code, username: "ana.perez", password: "12345678" });
    const { user } = await signInWithGoogle(ana, null);
    expect(user.username).not.toBe("ana.perez");
    expect(user.username.startsWith("ana.perez")).toBe(true);
    expect(await db.user.count()).toBe(2);
  });

  it("vincula Google a una cuenta con sesión, y no a dos", async () => {
    const { user } = await newMember("lucia");
    expect(await signInWithGoogle(ana, user.id)).toMatchObject({ linked: true });
    expect((await signInWithGoogle(ana, null)).user.id).toBe(user.id);

    const other = await newMember("pedro");
    expect(await fails(signInWithGoogle(ana, other.user.id))).toMatchObject({ code: "GOOGLE_IN_USE", status: 409 });
  });

  it("el anfitrión nunca entra ni se vincula con Google", async () => {
    await db.user.create({ data: { id: "host", role: "host", username: "anfitrion", displayName: "Anfitrión", spotifyAllowed: true } });
    expect(await fails(signInWithGoogle(ana, "host"))).toMatchObject({ code: "HOST_GOOGLE_FORBIDDEN" });
  });

  it("una cuenta desactivada no entra con Google", async () => {
    const { user } = await signInWithGoogle(ana, null);
    await db.user.update({ where: { id: user.id }, data: { disabledAt: new Date() } });
    expect(await fails(signInWithGoogle(ana, null))).toMatchObject({ code: "ACCOUNT_DISABLED" });
  });

  it("una cuenta gratis no puede grabar en modo Spotify hasta canjear una invitación", async () => {
    const { user } = await signInWithGoogle(ana, null);
    const spotifyGame = { mode: "spotify" as const, rounds: 3, players: ["Ana"], fragmentSeconds: 60 };
    expect(await fails(createGame(spotifyGame, freeOwner(user.id)))).toMatchObject({
      code: "SPOTIFY_INVITE_REQUIRED",
      status: 403,
    });

    const { code } = await createInvite("para Ana");
    expect(await redeemInvite(user.id, code)).toMatchObject({ spotifyAllowed: true });
    expect(await fails(redeemInvite(user.id, code))).toMatchObject({ code: "ALREADY_INVITED" });
    const invite = await db.invite.findFirstOrThrow();
    expect(invite.usedByUserId).toBe(user.id);
  });

  it("una invitación ya usada no sirve para otra cuenta", async () => {
    const { code } = await createInvite(null);
    const a = await signInWithGoogle(ana, null);
    const b = await signInWithGoogle({ sub: "google-bea", email: "bea@gmail.com", name: "Bea" }, null);
    await redeemInvite(a.user.id, code);
    expect(await fails(redeemInvite(b.user.id, code))).toMatchObject({ code: "INVALID_INVITE" });
  });

  it("el anfitrión da y quita el permiso; quitarlo desvincula su Spotify", async () => {
    const { user } = await signInWithGoogle(ana, null);
    await setMemberSpotify(user.id, true);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).spotifyAllowed).toBe(true);

    await db.spotifyAccount.create({
      data: { userId: user.id, spotifyUserId: "sp-ana", accessToken: "x", refreshToken: "y", expiresAt: new Date() },
    });
    await setMemberSpotify(user.id, false);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).spotifyAllowed).toBe(false);
    expect(await db.spotifyAccount.count()).toBe(0);
  });

  it("las cuentas gratis llevan los topes de los invitados; con invitación, no", async () => {
    const { user } = await signInWithGoogle(ana, null);
    const old = new Date(Date.now() - 2 * 24 * 60 * 60_000);
    await db.game.createMany({
      data: Array.from({ length: GUEST_LIMITS.gamesStored }, (_, i) => ({
        userId: user.id,
        code: `F${String(i).padStart(5, "0")}`,
        mode: "open",
        totalRounds: 1,
        fragmentSeconds: 30,
        filters: "{}",
        createdAt: old,
      })),
    });
    expect(await fails(assertOwnerCanCreateGame(freeOwner(user.id)))).toMatchObject({ code: "GUEST_SHELF_FULL" });
    await expect(
      assertOwnerCanCreateGame({ kind: "user", userId: user.id, spotifyAllowed: true }),
    ).resolves.toBeUndefined();
  });
});

describe("gestión de contraseñas", () => {
  const ctx = (keepSessionId: string | null = null) => ({ ipHash: "ip-pw", keepSessionId });

  it("cambia la suya con la actual y cierra sus otras sesiones", async () => {
    const { user } = await newMember("rosa", "la-de-siempre-1");
    const here = await openSession(user.id, "este");
    const other = await openSession(user.id, "otro");

    expect(await fails(changePassword(user.id, { current: "mala", next: "otra-nueva-22" }, ctx()))).toMatchObject({
      code: "WRONG_PASSWORD",
      status: 401,
    });
    const keep = sha256(here);
    expect(await changePassword(user.id, { current: "la-de-siempre-1", next: "otra-nueva-22" }, ctx(keep))).toEqual({
      closedSessions: 1,
    });
    expect(await userForSessionToken(here)).not.toBeNull();
    expect(await userForSessionToken(other)).toBeNull();
    await expect(authenticateMember("rosa", "otra-nueva-22", "ip-x")).resolves.toMatchObject({ username: "rosa" });
    await expect(authenticateMember("rosa", "la-de-siempre-1", "ip-x")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("valida la nueva: mínimo 8 y distinta de la actual", async () => {
    const { user } = await newMember("tomas", "la-de-siempre-1");
    await expect(changePassword(user.id, { current: "la-de-siempre-1", next: "corta" }, ctx())).rejects.toThrow();
    expect(
      await fails(changePassword(user.id, { current: "la-de-siempre-1", next: "la-de-siempre-1" }, ctx())),
    ).toMatchObject({ code: "SAME_PASSWORD" });
  });

  it("los fallos con la contraseña actual cuentan para el límite por IP", async () => {
    const { user } = await newMember("ines", "la-de-siempre-1");
    for (let i = 0; i < LOGIN_LIMITS.perIp; i++) {
      await expect(changePassword(user.id, { current: "mala", next: "otra-nueva-22" }, ctx())).rejects.toMatchObject({
        code: "WRONG_PASSWORD",
      });
    }
    expect(
      await fails(changePassword(user.id, { current: "la-de-siempre-1", next: "otra-nueva-22" }, ctx())),
    ).toMatchObject({ code: "TOO_MANY_ATTEMPTS", status: 429 });
  });

  it("una cuenta solo de Google se pone contraseña sin pedir la actual", async () => {
    const { user } = await signInWithGoogle({ sub: "g-ana", email: "ana@gmail.com", name: "Ana" }, null);
    await changePassword(user.id, { next: "mi-primera-clave" }, ctx());
    await expect(authenticateMember(user.username, "mi-primera-clave", "ip-y")).resolves.toMatchObject({ id: user.id });
  });

  it("el anfitrión restablece: temporal que funciona, sesiones cerradas y cambio obligatorio", async () => {
    const { user } = await newMember("pablo", "la-olvidada-11");
    const token = await openSession(user.id, "movil");
    await db.user.update({ where: { id: user.id }, data: { failedLogins: 3, lockedUntil: new Date(Date.now() + 60_000) } });

    const { password } = await resetMemberPassword(user.id);
    expect(password).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(await userForSessionToken(token)).toBeNull();
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after).toMatchObject({ mustChangePassword: true, failedLogins: 0, lockedUntil: null });

    await expect(authenticateMember("pablo", password, "ip-z")).resolves.toMatchObject({ id: user.id });
    await changePassword(user.id, { current: password, next: "ahora-la-mia-33" }, ctx());
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).mustChangePassword).toBe(false);
  });

  it("no se restablece al anfitrión ni a quien no existe", async () => {
    await db.user.create({ data: { id: "host", role: "host", username: "anfitrion", displayName: "Anfitrión" } });
    expect(await fails(resetMemberPassword("host"))).toMatchObject({ code: "MEMBER_NOT_FOUND" });
    expect(await fails(resetMemberPassword("no-existe"))).toMatchObject({ code: "MEMBER_NOT_FOUND" });
    expect(await fails(changePassword("host", { current: "x", next: "otra-nueva-22" }, ctx()))).toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("las temporales no se repiten", () => {
    expect(new Set(Array.from({ length: 200 }, temporaryPassword)).size).toBe(200);
  });
});

describe("gestión del historial", () => {
  it("cada dueño borra todo lo suyo y nada de los demás", async () => {
    const a = await newGuest("ip-a");
    const b = await newGuest("ip-b");
    const { owner: member } = await newMember();
    await openGame(a.owner);
    await openGame(a.owner);
    await openGame(b.owner);
    await openGame(member);

    expect(await deleteAllGames(a.owner)).toBe(2);
    expect((await listGames(a.owner)).total).toBe(0);
    expect((await listGames(b.owner)).total).toBe(1);
    expect((await listGames(member)).total).toBe(1);
    expect(await deleteAllGames(a.owner)).toBe(0);
  });

  it("el anfitrión borra el historial de un miembro sin tocar su cuenta", async () => {
    const { user, owner } = await newMember("pablo");
    const other = await newMember("rosa");
    await openGame(owner);
    await openGame(owner);
    await openGame(other.owner);

    expect(await deleteMemberGames(user.id)).toBe(2);
    expect(await db.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    expect((await listGames(owner)).total).toBe(0);
    expect((await listGames(other.owner)).total).toBe(1);
    expect(await fails(deleteMemberGames("no-existe"))).toMatchObject({ code: "MEMBER_NOT_FOUND", status: 404 });
  });
});

describe("respaldo contra abusos de invitados", () => {
  it("limita los invitados nuevos por IP", async () => {
    for (let i = 0; i < GUEST_LIMITS.guestsPerIpPerDay; i++) await registerGuest("ip-spam");
    expect(await fails(registerGuest("ip-spam"))).toMatchObject({ code: "GUEST_LIMIT", status: 429 });
    await expect(registerGuest("ip-normal")).resolves.toBeTruthy();
  });

  it("bloquear una IP corta a sus invitados actuales y a los nuevos", async () => {
    const { token } = await newGuest("ip-x");
    await blockIp((await db.guest.findFirstOrThrow()).ipHash);
    expect(await fails(guestForToken(token))).toMatchObject({ code: "GUEST_BLOCKED", status: 403 });
    expect(await fails(registerGuest("ip-x"))).toMatchObject({ code: "GUEST_BLOCKED" });
  });

  it("pausar el modo abierto o los invitados nuevos", async () => {
    const guest = await newGuest();
    const game = await openGame(guest.owner);

    await setAppFlags({ openModePaused: true });
    expect(await fails(assertOwnsGame(guest.owner, game.id))).toMatchObject({ code: "OPEN_MODE_PAUSED", status: 503 });
    expect(await fails(assertGuestCanCreateGame((guest.owner as { guestId: string }).guestId))).toMatchObject({
      code: "OPEN_MODE_PAUSED",
    });

    await setAppFlags({ openModePaused: false, guestSignupsPaused: true });
    await expect(assertOwnsGame(guest.owner, game.id)).resolves.toBeUndefined();
    expect(await fails(registerGuest("ip-nueva"))).toMatchObject({ code: "GUEST_SIGNUPS_PAUSED" });
  });

  it("topes de partidas y rondas por invitado", async () => {
    const guest = await newGuest();
    const guestId = (guest.owner as { guestId: string }).guestId;
    const old = new Date(Date.now() - 2 * 24 * 60 * 60_000);
    await db.game.createMany({
      data: Array.from({ length: GUEST_LIMITS.gamesStored }, (_, i) => ({
        guestId,
        code: `G${String(i).padStart(5, "0")}`,
        mode: "open",
        totalRounds: 1,
        fragmentSeconds: 30,
        filters: "{}",
        createdAt: old,
      })),
    });
    expect(await fails(assertGuestCanCreateGame(guestId))).toMatchObject({ code: "GUEST_SHELF_FULL" });

    const game = await db.game.findFirstOrThrow({ where: { guestId } });
    await db.round.createMany({
      data: Array.from({ length: GUEST_LIMITS.roundsPerHour }, (_, i) => ({
        gameId: game.id,
        number: i + 1,
        trackId: `t${i}`,
        trackUri: `itunes:track:${i}`,
        trackName: "Canción",
        artists: "[]",
        durationMs: 30_000,
        startMs: 0,
      })),
    });
    expect(await fails(assertGuestCanStartRound(guestId))).toMatchObject({ code: "GUEST_ROUND_LIMIT" });
  });

  it("la limpieza borra a los invitados inactivos con sus partidas; el botón del pánico, a todos", async () => {
    const stale = await newGuest("ip-1");
    const active = await newGuest("ip-2");
    await openGame(stale.owner);
    await openGame(active.owner);
    await db.guest.update({
      where: { id: (stale.owner as { guestId: string }).guestId },
      data: { lastSeenAt: new Date(Date.now() - (GUEST_LIMITS.inactiveDays + 1) * 24 * 60 * 60_000) },
    });

    expect(await runCleanup()).toMatchObject({ guests: 1 });
    expect(await db.game.count()).toBe(1);
    expect(await deleteAllGuests()).toBe(1);
    expect(await db.game.count()).toBe(0);
  });
});
