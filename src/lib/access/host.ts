import "server-only";
import { db } from "@/lib/db";
import { burnPasswordCheck, verifyPassword } from "./password";
import { getAppState } from "./state";
import { assertLoginAllowed, invalidCredentials, recordLoginAttempt } from "./throttle";
import { base32Decode, verifyTotp } from "./totp";

export const HOST_USER_ID = "host";

/** Secretos del anfitrión. Si falta alguno, nadie puede entrar como anfitrión (falla cerrado). */
export function hostSecrets() {
  const passwordHash = process.env.HOST_PASSWORD_HASH;
  const totpSecret = process.env.HOST_TOTP_SECRET;
  if (!passwordHash || !totpSecret || !process.env.TOKEN_ENCRYPTION_KEY) return null;
  try {
    return { passwordHash, totpKey: base32Decode(totpSecret) };
  } catch {
    return null;
  }
}

/**
 * Entrada del anfitrión: contraseña y código TOTP a la vez, con el mismo error para cualquier fallo.
 * Un código ya aceptado no vuelve a servir (anti-replay).
 */
export async function authenticateHost(password: string, code: string, ipHash: string, now = new Date()) {
  await assertLoginAllowed(ipHash, now);
  const secrets = hostSecrets();

  const passwordOk = secrets ? await verifyPassword(password, secrets.passwordHash) : await burnPasswordCheck(password);
  const counter = secrets ? verifyTotp(secrets.totpKey, code, now.getTime()) : null;

  let ok = passwordOk && counter !== null;
  if (ok) {
    await getAppState();
    const claimed = await db.appState.updateMany({
      where: { id: "app", OR: [{ lastTotpCounter: null }, { lastTotpCounter: { lt: counter! } }] },
      data: { lastTotpCounter: counter! },
    });
    ok = claimed.count === 1;
  }

  await recordLoginAttempt(ipHash, ok);
  if (!ok) throw invalidCredentials();

  return db.user.upsert({
    where: { id: HOST_USER_ID },
    create: { id: HOST_USER_ID, role: "host", username: "anfitrion", displayName: "Anfitrión" },
    update: { disabledAt: null },
  });
}
