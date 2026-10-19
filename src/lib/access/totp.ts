import { createHmac, timingSafeEqual } from "node:crypto";

// Códigos de un solo uso basados en tiempo (RFC 6238), compatibles con Google Authenticator, 1Password, etc.

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;

export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error("Secreto TOTP inválido (no es base32)");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** HOTP (RFC 4226) con HMAC-SHA1. */
export function hotp(key: Buffer, counter: number, digits = 6): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(message).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totpCounter(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

/**
 * Comprueba un código admitiendo un paso de desfase hacia cada lado (relojes desajustados).
 * Devuelve el contador que coincidió (para impedir reutilizarlo) o null.
 */
export function verifyTotp(
  key: Buffer,
  code: string,
  nowMs: number,
  { window = 1, digits = 6 }: { window?: number; digits?: number } = {},
): number | null {
  const given = Buffer.from(code.replace(/\s/g, ""));
  if (given.length !== digits) return null;
  const current = totpCounter(nowMs);
  let matched: number | null = null;
  // Recorre todos los pasos aunque ya haya coincidido, para no delatar nada por el tiempo.
  for (let step = -window; step <= window; step++) {
    const expected = Buffer.from(hotp(key, current + step, digits));
    if (timingSafeEqual(expected, given) && matched === null) matched = current + step;
  }
  return matched;
}
