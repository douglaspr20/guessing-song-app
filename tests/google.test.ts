import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { pkceChallenge, pkcePair, readIdToken, usernameFromEmail } from "@/lib/access/google-token";

const CLIENT = "cliente.apps.googleusercontent.com";
const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);

/** id_token de mentira: cabecera y firma no importan, solo el payload. */
function token(claims: Record<string, unknown>) {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.firma`;
}

const valid = {
  iss: "https://accounts.google.com",
  aud: CLIENT,
  sub: "1234567890",
  email: "ana.perez@gmail.com",
  email_verified: true,
  name: "Ana Pérez",
  nonce: "n-123",
  exp: NOW / 1000 + 3600,
};

describe("readIdToken", () => {
  const read = (claims: Record<string, unknown>) => readIdToken(token(claims), { clientId: CLIENT, nonce: "n-123", now: NOW });

  it("devuelve el perfil de un token válido", () => {
    expect(read(valid)).toEqual({ sub: "1234567890", email: "ana.perez@gmail.com", name: "Ana Pérez" });
    expect(read({ ...valid, iss: "accounts.google.com" })).not.toBeNull();
  });

  it("rechaza tokens de otra app, de otro emisor, caducados o de otro intento", () => {
    expect(read({ ...valid, aud: "otra-app" })).toBeNull();
    expect(read({ ...valid, iss: "https://evil.example" })).toBeNull();
    expect(read({ ...valid, exp: NOW / 1000 - 1 })).toBeNull();
    expect(read({ ...valid, nonce: "otro" })).toBeNull();
  });

  it("exige el correo verificado", () => {
    expect(read({ ...valid, email_verified: false })).toBeNull();
    expect(read({ ...valid, email_verified: undefined })).toBeNull();
  });

  it("no revienta con basura", () => {
    expect(readIdToken("no-es-un-jwt", { clientId: CLIENT, nonce: "n-123", now: NOW })).toBeNull();
    expect(readIdToken("a.%%%.c", { clientId: CLIENT, nonce: "n-123", now: NOW })).toBeNull();
  });
});

describe("PKCE (S256)", () => {
  it("el reto es el SHA-256 en base64url del verificador", () => {
    const { verifier, challenge } = pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    // Vector del RFC 7636 (apéndice B).
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("usernameFromEmail", () => {
  it("limpia el correo para el nombre de usuario", () => {
    expect(usernameFromEmail("Ana.Pérez+juegos@gmail.com")).toBe("ana.perez");
    expect(usernameFromEmail("jo@x.com")).toBe("jugadorjo");
    expect(usernameFromEmail("a-b c@x.com")).toBe("abc");
  });
});
