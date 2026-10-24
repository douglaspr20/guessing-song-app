import { describe, expect, it } from "vitest";
import { withVerifyFull } from "@/lib/db-url";

describe("withVerifyFull", () => {
  it("pide verify-full cuando la URL usa un modo que pg va a debilitar", () => {
    expect(withVerifyFull("postgresql://u:p@host/db?sslmode=require")).toBe(
      "postgresql://u:p@host/db?sslmode=verify-full",
    );
    expect(
      withVerifyFull("postgresql://u:p@host/db?x=1&sslmode=prefer&y=2"),
    ).toBe("postgresql://u:p@host/db?x=1&sslmode=verify-full&y=2");
    expect(withVerifyFull("postgresql://u:p@host/db?sslmode=verify-ca")).toBe(
      "postgresql://u:p@host/db?sslmode=verify-full",
    );
  });

  it("no toca el resto", () => {
    for (const url of [
      "postgresql://adivina:adivina@localhost:5432/adivina",
      "postgresql://u:p@host/db?sslmode=verify-full",
      "postgresql://u:p@host/db?sslmode=disable",
    ]) {
      expect(withVerifyFull(url)).toBe(url);
    }
  });
});
