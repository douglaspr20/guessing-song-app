import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/access/crypto";
import { hashPassword, verifyPassword } from "@/lib/access/password";
import { base32Decode, base32Encode, hotp, totpCounter, verifyTotp } from "@/lib/access/totp";

describe("contraseñas (scrypt)", () => {
  it("verifica la correcta y rechaza la errónea", async () => {
    const stored = await hashPassword("una contraseña larga");
    expect(stored.startsWith("scrypt:16384:8:1:")).toBe(true);
    expect(await verifyPassword("una contraseña larga", stored)).toBe(true);
    expect(await verifyPassword("una contraseña largA", stored)).toBe(false);
  });

  it("usa una sal distinta cada vez", async () => {
    expect(await hashPassword("igual")).not.toBe(await hashPassword("igual"));
  });

  it("un hash mal formado nunca verifica", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt:1:2:3:4:5")).toBe(false);
    expect(await verifyPassword("x", "scrypt:99999999:8:1:c2FsdA==:aGFzaA==")).toBe(false);
  });
});

describe("TOTP (RFC 6238)", () => {
  // Vectores oficiales del RFC 6238 (SHA-1, 8 dígitos, secreto ASCII "12345678901234567890").
  const key = Buffer.from("12345678901234567890");
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("a los %d s el código es %s", (seconds, code) => {
    expect(hotp(key, totpCounter(seconds * 1000), 8)).toBe(code);
  });

  it("acepta un paso de desfase y devuelve el contador que coincidió", () => {
    const now = 1_700_000_000_000;
    const counter = totpCounter(now);
    expect(verifyTotp(key, hotp(key, counter), now)).toBe(counter);
    expect(verifyTotp(key, hotp(key, counter - 1), now)).toBe(counter - 1);
    expect(verifyTotp(key, hotp(key, counter + 1), now)).toBe(counter + 1);
    expect(verifyTotp(key, hotp(key, counter - 2), now)).toBeNull();
  });

  it("rechaza longitudes raras sin lanzar", () => {
    expect(verifyTotp(key, "123", Date.now())).toBeNull();
    expect(verifyTotp(key, "", Date.now())).toBeNull();
  });

  it("base32 ida y vuelta", () => {
    const secret = randomBytes(20);
    const encoded = base32Encode(secret);
    expect(encoded).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(encoded).equals(secret)).toBe(true);
    expect(base32Decode(encoded.toLowerCase().replace(/(.{4})/g, "$1 ")).equals(secret)).toBe(true);
  });
});

describe("cifrado de tokens (AES-256-GCM)", () => {
  const key = randomBytes(32);

  it("descifra lo que cifró", () => {
    const sealed = encryptSecret("BQD-token-de-spotify", key);
    expect(sealed).not.toContain("BQD");
    expect(decryptSecret(sealed, key)).toBe("BQD-token-de-spotify");
  });

  it("falla si el texto se alteró o la clave es otra", () => {
    const sealed = encryptSecret("secreto", key);
    const [v, iv, tag, data] = sealed.split(".");
    const flipped = data.startsWith("A") ? `B${data.slice(1)}` : `A${data.slice(1)}`;
    expect(() => decryptSecret([v, iv, tag, flipped].join("."), key)).toThrow();
    expect(() => decryptSecret(sealed, randomBytes(32))).toThrow();
  });
});
