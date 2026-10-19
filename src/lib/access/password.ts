import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Formato guardado: scrypt:N:r:p:sal:hash (sal y hash en base64). Mismo formato que genera `npm run host:setup`.
// Sin «$»: en los archivos .env Next expandiría «$algo» como si fuera una variable.
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 32;
const MAX_N = 1 << 20;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...options, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join(":");
}

/** Compara en tiempo constante. Un hash mal formado nunca verifica. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split(":");
  const N = Number(n);
  if (scheme !== "scrypt" || !salt || !hash || !Number.isInteger(N) || N < 2 || N > MAX_N) return false;
  const expected = Buffer.from(hash, "base64");
  if (expected.length !== KEY_LENGTH) return false;
  const key = await derive(password, Buffer.from(salt, "base64"), { N, r: Number(r), p: Number(p) });
  return timingSafeEqual(key, expected);
}

let dummyHash: Promise<string> | null = null;

/**
 * Gasta lo mismo que una verificación real aunque el usuario no exista, para que el tiempo
 * de respuesta no delate qué nombres de usuario están registrados.
 */
export async function burnPasswordCheck(password: string): Promise<false> {
  dummyHash ??= hashPassword("contraseña-de-relleno");
  await verifyPassword(password, await dummyHash);
  return false;
}
