import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { describeGuess, spokenFeedback } from "@/app/game/[id]/_lib/feedback";
import { errorMessage, isErrorKey } from "@/i18n/errors";
import { formatList, plural } from "@/i18n/format";
import { fromAcceptLanguage, localeFromRequest, readCookie, resolveLocale } from "@/i18n/locales";
import { MESSAGES } from "@/i18n/messages";
import { GENRES } from "@/lib/spotify/catalog";
import { errors as enErrors } from "@/i18n/messages/en/errors";
import { errors as esErrors } from "@/i18n/messages/es/errors";
import { AppError, toErrorResponse } from "@/lib/errors";
import type { GuessResult } from "@/lib/client/api";
import { defaultTeamName, emptyTeams, teamsProblem } from "@/lib/game/teams";

describe("elegir el idioma", () => {
  it("manda la cookie del selector", () => {
    expect(resolveLocale("en", "es-ES,es;q=0.9")).toBe("en");
    expect(resolveLocale("es", "en-US")).toBe("es");
  });

  it("sin cookie, el primer idioma admitido del navegador según su peso", () => {
    expect(resolveLocale(null, "en-US,en;q=0.9,es;q=0.8")).toBe("en");
    expect(resolveLocale(null, "fr-FR,es;q=0.5,en;q=0.7")).toBe("en");
    expect(fromAcceptLanguage("de-DE,fr;q=0.9")).toBeNull();
  });

  it("si nada encaja, español; una cookie con un idioma raro no cuenta", () => {
    expect(resolveLocale(null, null)).toBe("es");
    expect(resolveLocale("klingon", "de-DE")).toBe("es");
    expect(resolveLocale(undefined, "en;q=0")).toBe("es");
  });

  it("lee la cookie de una petición a la API", () => {
    expect(readCookie("a=1; locale=en; b=2", "locale")).toBe("en");
    const req = new Request("http://x/api", { headers: { cookie: "locale=en", "accept-language": "es" } });
    expect(localeFromRequest(req)).toBe("en");
  });
});

describe("plurales y listas", () => {
  it("usa la forma de cada idioma", () => {
    expect(plural("es", 1, MESSAGES.es.play.tracks)).toBe("1 pista");
    expect(plural("es", 3, MESSAGES.es.play.tracks)).toBe("3 pistas");
    expect(plural("en", 1, MESSAGES.en.play.tracks)).toBe("1 track");
    expect(plural("en", 0, MESSAGES.en.play.tracks)).toBe("0 tracks");
  });

  it("une nombres con la conjunción del idioma", () => {
    expect(formatList("es", ["Ana", "Luis"])).toBe("Ana y Luis");
    expect(formatList("en", ["Ana", "Luis", "Marta"])).toBe("Ana, Luis, and Marta");
  });
});

/** Recorre dos diccionarios a la vez y anota dónde no tienen la misma forma. */
function differences(a: unknown, b: unknown, path = ""): string[] {
  if (typeof a === "function" || typeof b === "function") {
    if (typeof a !== typeof b) return [`${path}: función en un idioma y no en el otro`];
    return (a as (...x: unknown[]) => unknown).length === (b as (...x: unknown[]) => unknown).length
      ? []
      : [`${path}: distinto número de datos`];
  }
  if (a && typeof a === "object" && b && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) =>
      k in a && k in b
        ? differences((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`)
        : [`${path}.${k}: falta en un idioma`],
    );
  }
  if (typeof a !== typeof b) return [`${path}: tipos distintos`];
  if (typeof a === "string" && typeof b === "string") {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    if (vars(a) !== vars(b)) return [`${path}: variables distintas`];
    if (!b.trim() && a.trim()) return [`${path}: vacío en inglés`];
  }
  return [];
}

describe("diccionarios", () => {
  it("español e inglés tienen las mismas claves, datos y {variables}", () => {
    expect(differences(MESSAGES.es, MESSAGES.en)).toEqual([]);
    expect(differences(esErrors, enErrors)).toEqual([]);
  });

  it("cada género del catálogo tiene nombre en los dos idiomas", () => {
    for (const locale of ["es", "en"] as const) {
      expect(GENRES.filter((g) => !MESSAGES[locale].setup.genreLabels[g])).toEqual([]);
    }
  });

  it("cada error que lanza el servidor tiene su texto", () => {
    const files = execSync('git ls-files -co --exclude-standard -- "src/*.ts" "src/*.tsx"', { encoding: "utf8" })
      .trim()
      .split("\n")
      // Git aún lista los archivos recién movidos o borrados que no se han confirmado.
      .filter((file) => existsSync(file));
    const missing: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/new AppError\(\s*"([A-Z_]+)"\s*,\s*[^,)]+(?:,\s*\{([^}]*)\})?/g)) {
        const key = m[2]?.match(/key:\s*"([A-Z_]+)"/)?.[1] ?? m[1];
        if (!isErrorKey(key)) missing.push(`${file}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("errores de la API en el idioma de quien pregunta", () => {
  it("traduce un AppError con sus datos", async () => {
    const err = new AppError("TEAM_FULL", 409, { params: { team: "Equipo Menta" } });
    expect(await (await toErrorResponse(err, "es")).json()).toEqual({ error: "TEAM_FULL", message: "Equipo Menta está lleno" });
    expect(await (await toErrorResponse(err, "en")).json()).toEqual({ error: "TEAM_FULL", message: "Equipo Menta is full" });
    // El mensaje interno (logs) queda en español.
    expect(err.message).toBe("Equipo Menta está lleno");
  });

  it("un mismo código puede tener otro texto con `key`", () => {
    const err = new AppError("NOT_FOUND", 404, { key: "GOOGLE_NOT_CONFIGURED" });
    expect(err.code).toBe("NOT_FOUND");
    expect(err.messageIn("en")).toBe(errorMessage("en", "GOOGLE_NOT_CONFIGURED"));
  });

  it("el detalle técnico no llega a la respuesta", async () => {
    const err = new AppError("SPOTIFY_API_ERROR", 502, { detail: "Spotify 500: boom" });
    expect(err.message).toContain("boom");
    expect((await (await toErrorResponse(err, "es")).json()).message).not.toContain("boom");
  });

  it("los esquemas que se muestran tal cual usan claves del diccionario", async () => {
    const parsed = z.string().min(8, "PASSWORD_TOO_SHORT").safeParse("corta");
    const res = await toErrorResponse(parsed.error, "en");
    expect(res.status).toBe(422);
    expect((await res.json()).message).toBe(enErrors.PASSWORD_TOO_SHORT);
  });
});

describe("textos que arma la lógica", () => {
  const result = { titleAwarded: true, titleCorrect: true, artistAwarded: true, artistCorrect: true, points: 4 } as GuessResult;

  it("las frases tras una respuesta salen en el idioma pedido", () => {
    expect(describeGuess("Luis", result, { title: true, artist: true }).text).toBe("Luis: ¡acertó la canción y el artista! +4");
    expect(describeGuess("Luis", result, { title: true, artist: true }, MESSAGES.en.game.feedback).text).toBe(
      "Luis: got the song and the artist! +4",
    );
    expect(spokenFeedback("Ana", "title", 3, MESSAGES.en.game.feedback).text).toBe("Ana: got the song! +3");
  });

  it("los equipos nacen con el nombre del idioma de quien crea la partida", () => {
    expect(defaultTeamName("menta")).toBe("Equipo Menta");
    expect(defaultTeamName("menta", MESSAGES.en.setup)).toBe("Team Mint");
    expect(emptyTeams(2, MESSAGES.en.setup).map((t) => t.name)).toEqual(["Team Saffron", "Team Sky"]);
    expect(teamsProblem(emptyTeams(2, MESSAGES.en.setup), 3, MESSAGES.en.setup)).toBe("Add the people who are playing.");
  });
});
