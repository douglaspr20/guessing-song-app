import { describe, expect, it } from "vitest";
import { byPalette, placeOf, winnerSummary, withPlaces } from "@/lib/game/standings";

const p = (id: string, score: number, color: string | null = null) => ({ id, name: id, score, color });

describe("puestos", () => {
  it("los empatados comparten puesto y el siguiente salta", () => {
    const players = [p("Ana", 5), p("Luis", 5), p("Marta", 2)];
    expect(withPlaces(players).map((x) => x.place)).toEqual([1, 1, 3]);
    expect(placeOf(p("Otro", 2), players)).toBe(3);
  });
});

describe("cómo acabó", () => {
  it("nadie, empate o ganador", () => {
    expect(winnerSummary([])).toEqual({ kind: "none" });
    expect(winnerSummary([p("Ana", 0), p("Luis", 0)])).toEqual({ kind: "none" });
    expect(winnerSummary([p("Ana", 3), p("Luis", 3), p("Marta", 1)])).toEqual({ kind: "tie", names: ["Ana", "Luis"] });
    expect(winnerSummary([p("Ana", 4), p("Luis", 3)])).toEqual({ kind: "winner", id: "Ana", name: "Ana" });
  });
});

describe("orden de la paleta", () => {
  it("ordena los equipos por su color, no por puntos", () => {
    const teams = [p("B", 9, "menta"), p("A", 1, "azafran"), p("C", 5, "cielo")];
    expect([...teams].sort(byPalette).map((t) => t.id)).toEqual(["A", "C", "B"]);
  });
});
