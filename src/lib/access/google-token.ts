import { createHash, randomBytes } from "node:crypto";

// Piezas puras del inicio de sesión con Google (OpenID Connect), sin base de datos: se testean solas.

/** Par PKCE (S256): el `verifier` se queda en nuestra cookie y a Google solo le llega el reto. */
export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: pkceChallenge(verifier) };
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
}

const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

/**
 * Lee el id_token que acabamos de recibir del endpoint de tokens de Google. Llega por TLS y a cambio
 * de nuestro secreto, así que OIDC permite no verificar la firma; sí comprobamos para quién es,
 * quién lo emite, que no haya caducado, el `nonce` de este intento y que el correo esté verificado.
 * Devuelve null si algo no cuadra.
 */
export function readIdToken(
  idToken: string,
  { clientId, nonce, now = Date.now() }: { clientId: string; nonce: string; now?: number },
): GoogleProfile | null {
  const [, payload] = idToken.split(".");
  if (!payload) return null;
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const aud = claims.aud;
  const audOk = aud === clientId || (Array.isArray(aud) && aud.includes(clientId));
  if (!audOk || !ISSUERS.has(String(claims.iss))) return null;
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return null;
  if (claims.nonce !== nonce) return null;
  if (claims.email_verified !== true && claims.email_verified !== "true") return null;
  if (typeof claims.sub !== "string" || !claims.sub || typeof claims.email !== "string") return null;
  return { sub: claims.sub, email: claims.email, name: typeof claims.name === "string" ? claims.name : null };
}

/** Nombre de usuario a partir del correo: «Ana.Pérez+x@gmail.com» → «ana.perez». */
export function usernameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const clean = local
    .split("+")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 24);
  return clean.length >= 3 ? clean : `jugador${clean}`.slice(0, 24);
}
