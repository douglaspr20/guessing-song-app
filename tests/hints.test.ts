import { describe, expect, it } from "vitest";
import * as en from "@/i18n/messages/en";
import * as es from "@/i18n/messages/es";
import { hintMarks } from "@/lib/client/hints";
import { OPEN_RULES, SPOTIFY_RULES } from "@/lib/game/scoring";

describe("marcas de pista (tele y móvil)", () => {
  it("salen las tres en orden, con el segundo de cada regla, y bloqueadas sin valor", () => {
    const marks = hintMarks({ hints: [] }, OPEN_RULES, es.game, "es");

    expect(marks.map((h) => [h.key, h.label, h.at])).toEqual([
      ["words", "Palabras", "10 s"],
      ["artist", "Artista", "20 s"],
      ["letters", "Letras", "25 s"],
    ]);
    expect(marks.every((h) => !h.unlocked && h.value === null)).toBe(true);
    expect(hintMarks({ hints: [] }, SPOTIFY_RULES, es.game, "es").map((h) => h.at)).toEqual(["20 s", "40 s", "60 s"]);
  });

  it("las desbloqueadas llevan su valor, y las palabras se redactan en el idioma de la pantalla", () => {
    const round = {
      hints: [
        { type: "words" as const, value: "3" },
        { type: "artist" as const, value: "Soda Stereo" },
      ],
    };

    const marks = hintMarks(round, OPEN_RULES, es.game, "es");
    expect(marks.map((h) => [h.unlocked, h.value])).toEqual([
      [true, "3 palabras"],
      [true, "Soda Stereo"],
      [false, null],
    ]);
    expect(hintMarks({ hints: [{ type: "words", value: "1" }] }, OPEN_RULES, en.game, "en")[0].value).toBe("1 word");
  });
});
