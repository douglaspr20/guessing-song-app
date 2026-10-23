import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";

// Cifrado autenticado (AES-256-GCM) para los tokens de Spotify guardados en la base de datos.
// Formato: v1.<iv>.<tag>.<texto cifrado>, todo en base64url.

const VERSION = "v1";

/** Clave de TOKEN_ENCRYPTION_KEY (32 bytes en base64). Sin ella no se guardan tokens. */
export function encryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  const key = raw ? Buffer.from(raw, "base64") : null;
  if (!key || key.length !== 32) {
    throw new AppError(
      "Falta configurar el cifrado de tokens en el servidor",
      500,
      "ACCESS_NOT_CONFIGURED",
    );
  }
  return key;
}

export function encryptSecret(plain: string, key: Buffer = encryptionKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** Lanza si el texto se alteró o se cifró con otra clave. */
export function decryptSecret(token: string, key: Buffer = encryptionKey()): string {
  const [version, iv, tag, data] = token.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) throw new Error("Secreto cifrado con formato desconocido");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
