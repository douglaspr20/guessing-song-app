import { describe, expect, it } from "vitest";
import {
  artistAvailable,
  elapsedMs,
  OPEN_RULES,
  pointsForElapsed,
  rulesFor,
  SPOTIFY_RULES,
  titleLetters,
  titleWordCount,
  unlockedHints,
} from "@/lib/game/scoring";

const start = new Date("2026-10-16T12:00:00Z");
const at = (s: number) => new Date(start.getTime() + s * 1000);
const round = {
  playStartedAt: start,
  trackName: "De Música Ligera - Remastered 2007",
  artists: ["Soda Stereo"],
  genre: "rock en espanol",
};

describe("pointsForElapsed", () => {
  it.each([
    [0, 3],
    [19.9, 3],
    [20, 2],
    [39.9, 2],
    [40, 1],
    [90, 1],
  ])("a los %d s vale %d", (s, pts) => {
    expect(pointsForElapsed(s * 1000)).toBe(pts);
  });
});

describe("elapsedMs", () => {
  it("es 0 si aún no ha sonado", () => {
    expect(elapsedMs({ playStartedAt: null }, at(30))).toBe(0);
  });
  it("descuenta pausas pasadas y la pausa en curso", () => {
    expect(elapsedMs({ playStartedAt: start, pausedMs: 10_000 }, at(30))).toBe(20_000);
    expect(elapsedMs({ playStartedAt: start, pausedAt: at(15), pausedMs: 0 }, at(40))).toBe(15_000);
  });
  it("en pausa no programa la siguiente pista", () => {
    expect(unlockedHints({ ...round, pausedAt: at(5) }, at(30)).nextHintAt).toBeNull();
  });
});

describe("titleLetters", () => {
  it("muestra la primera letra de cada palabra sin sufijos", () => {
    expect(titleLetters("De Música Ligera - Remastered 2007")).toBe("D_ M_____ L_____");
    expect(titleLetters("Bailando (feat. Descemer Bueno)")).toBe("B_______");
    expect(titleLetters("Livin' la Vida Loca")).toBe("L____ L_ V___ L___");
  });
});

describe("titleWordCount", () => {
  it("cuenta las palabras del título limpio", () => {
    expect(titleWordCount("De Música Ligera - Remastered 2007")).toBe("3 palabras");
    expect(titleWordCount("Bailando (feat. Descemer Bueno)")).toBe("1 palabra");
    expect(titleWordCount("Hey Jude")).toBe("2 palabras");
  });
});

describe("unlockedHints", () => {
  it("no muestra nada antes de que suene", () => {
    expect(unlockedHints({ ...round, playStartedAt: null }, at(100))).toEqual({ hints: [], nextHintAt: null });
  });

  it("desbloquea palabras, artista y letras cada 20 s", () => {
    const h0 = unlockedHints(round, at(5));
    expect(h0.hints).toEqual([]);
    expect(h0.nextHintAt).toEqual(at(20));

    const h1 = unlockedHints(round, at(20));
    expect(h1.hints).toEqual([{ type: "words", value: "3 palabras" }]);
    expect(h1.nextHintAt).toEqual(at(40));

    const h2 = unlockedHints(round, at(45));
    expect(h2.hints.map((h) => h.type)).toEqual(["words", "artist"]);
    expect(h2.hints[1].value).toBe("Soda Stereo");

    const h3 = unlockedHints(round, at(61));
    expect(h3.hints.map((h) => h.type)).toEqual(["words", "artist", "letters"]);
    expect(h3.nextHintAt).toBeNull();
  });

  it("muestra todas al cerrar la ronda", () => {
    expect(unlockedHints(round, at(1), true).hints).toHaveLength(3);
  });

});

describe("artistAvailable", () => {
  it("vale hasta que sale la pista del artista (40 s)", () => {
    expect(artistAvailable(round, at(39.9))).toBe(true);
    expect(artistAvailable(round, at(40))).toBe(false);
  });
});

describe("reglas del modo abierto (vistas previas de 30 s)", () => {
  it.each([
    [0, 3],
    [9.9, 3],
    [10, 2],
    [19.9, 2],
    [20, 1],
    [29, 1],
  ])("a los %d s vale %d", (s, pts) => {
    expect(pointsForElapsed(s * 1000, OPEN_RULES)).toBe(pts);
  });

  it("desbloquea las pistas a los 10, 20 y 25 s", () => {
    expect(unlockedHints(round, at(9), false, OPEN_RULES).hints).toEqual([]);
    expect(unlockedHints(round, at(10), false, OPEN_RULES).hints.map((h) => h.type)).toEqual(["words"]);
    expect(unlockedHints(round, at(20), false, OPEN_RULES).hints.map((h) => h.type)).toEqual(["words", "artist"]);
    const late = unlockedHints(round, at(25), false, OPEN_RULES);
    expect(late.hints.map((h) => h.type)).toEqual(["words", "artist", "letters"]);
    expect(late.nextHintAt).toBeNull();
  });

  it("el artista suma hasta los 20 s", () => {
    expect(artistAvailable(round, at(19.9), OPEN_RULES)).toBe(true);
    expect(artistAvailable(round, at(20), OPEN_RULES)).toBe(false);
  });

  it("rulesFor elige por modo", () => {
    expect(rulesFor("open")).toBe(OPEN_RULES);
    expect(rulesFor("spotify")).toBe(SPOTIFY_RULES);
    expect(rulesFor(undefined)).toBe(SPOTIFY_RULES);
  });
});
