import { randomBytes, scryptSync } from "node:crypto";
import { base32Encode } from "../../src/lib/access/totp";

export const E2E_PORT = 3100;

export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://adivina:adivina@localhost:5432/adivina_e2e";

/** Contraseña y secreto TOTP del anfitrión de pruebas (solo existen en esta base y en este servidor). */
export const HOST_PASSWORD = "contraseña-de-pruebas-e2e";
export const HOST_TOTP_SECRET = base32Encode(Buffer.from("secreto-totp-e2e-12345"));

/** Mismo formato que `hashPassword` (scrypt:N:r:p:sal:hash), en síncrono para poder usarlo al cargar la config. */
function hostPasswordHash(): string {
  const salt = randomBytes(16);
  const key = scryptSync(HOST_PASSWORD.normalize("NFKC"), salt, 32, { N: 16384, r: 8, p: 1 });
  return ["scrypt", 16384, 8, 1, salt.toString("base64"), key.toString("base64")].join(":");
}

/** Variables del servidor de pruebas. Ably, Spotify y Google quedan sin definir a propósito. */
export const E2E_ENV: Record<string, string> = {
  DATABASE_URL: E2E_DATABASE_URL,
  DATABASE_URL_UNPOOLED: E2E_DATABASE_URL,
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  HOST_PASSWORD_HASH: hostPasswordHash(),
  HOST_TOTP_SECRET,
  CRON_SECRET: "cron-e2e",
  E2E_FAKE_ITUNES: "1",
};
