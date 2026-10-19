import { createHash, createHmac, randomBytes } from "node:crypto";

/** SHA-256 en hexadecimal. Lo usamos para guardar tokens de cookies e invitaciones sin guardarlos en claro. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Token aleatorio apto para cookies (base64url). 32 bytes = 256 bits. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Hash de una IP para limitar intentos sin guardar la IP. Con TOKEN_ENCRYPTION_KEY es un HMAC,
 * así que no se puede revertir probando las ~4 000 millones de IPv4.
 */
export function hashIp(ip: string): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  const value = `ip:${ip}`;
  return key ? createHmac("sha256", key).update(value).digest("hex") : sha256(value);
}
