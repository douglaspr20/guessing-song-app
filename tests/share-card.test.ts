import { describe, expect, it } from "vitest";
import { buildCardModel, CARD_REST_MAX, headlineOf, plainCard, type SharedPlayer, type SharedResult } from "@/lib/game/share-card";
import { withPlaces } from "@/lib/game/standings";

const player = (name: string, score: number, extra: Partial<SharedPlayer> = {}) => ({ name, score, color: null, members: [], ...extra });

/** Una partida terminada, con los jugadores ya ordenados como los entrega el servidor. */
function result(players: ReturnType<typeof player>[], extra: Partial<SharedResult> = {}): SharedResult {
  return {
    locale: "es",
    catalogNumber: 14,
    createdAt: new Date(Date.UTC(2026, 9, 28, 12)),
    totalRounds: 10,
    players: withPlaces(players).map((p, i) => ({ ...p, id: String(i + 1) })),
    ...extra,
  };
}

describe("tarjeta del resultado", () => {
  it("un ganador: titular, podio y la línea del casete", () => {
    const card = buildCardModel(result([player("Ana", 9), player("Luis", 6), player("Marta", 2)]));

    expect(card).toMatchObject({ scored: true, headlinePrefix: "Ganó", headlineText: "Ana", cat: "C-014", tracks: "10 pistas" });
    expect(card.meta).toBe("C-014 · 10 pistas · 28 oct 2026");
    expect(headlineOf(card)).toBe("Ganó Ana");
    expect(card.podium.map((e) => [e.place, e.name, e.score])).toEqual([[1, "Ana", 9], [2, "Luis", 6], [3, "Marta", 2]]);
    expect(card.rest).toEqual([]);
    expect(card.more).toBeNull();
  });

  it("un empate nombra a los empatados", () => {
    const card = buildCardModel(result([player("Ana", 5), player("Luis", 5), player("Marta", 1)]));

    expect(card.headlinePrefix).toBe("Empate entre");
    expect(card.headlineText).toBe("Ana y Luis");
    expect(card.podium.map((e) => e.place)).toEqual([1, 1, 3]);
  });

  it("si nadie sumó no hay podio ni lista", () => {
    const card = buildCardModel(result([player("Ana", 0), player("Luis", 0)]));

    expect(card).toMatchObject({ scored: false, headlinePrefix: null, headlineText: "Nadie sumó puntos", podium: [], rest: [], more: null });
  });

  it("del 4.º en adelante hay lista, con «y N más» si no caben todos", () => {
    const names = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
    const card = buildCardModel(result(names.map((n, i) => player(n, 20 - i))));

    expect(card.podium).toHaveLength(3);
    expect(card.rest.map((e) => e.name)).toEqual(["D", "E", "F", "G", "H"].slice(0, CARD_REST_MAX));
    expect(card.more).toBe("y 3 más");
  });

  it("la lista de debajo del podio cabe según el formato", () => {
    const names = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const players = result(names.map((n, i) => player(n, 20 - i)));

    const wide = buildCardModel(players, "es", 3);

    expect(wide.rest.map((e) => e.name)).toEqual(["D", "E", "F"]);
    expect(wide.more).toBe("y 2 más");
    expect(buildCardModel(players, "es", 5).more).toBeNull();
  });

  it("por equipos conserva el color y los miembros", () => {
    const card = buildCardModel(
      result([player("Tomates", 8, { color: "teja", members: ["Ana", "Luis"] }), player("Cielo", 3, { color: "cielo", members: ["Marta"] })]),
    );

    expect(card.podium[0]).toMatchObject({ name: "Tomates", color: "teja", members: ["Ana", "Luis"] });
  });

  it("sale en el idioma pedido", () => {
    const card = buildCardModel(result([player("Ana", 9), player("Luis", 6)]), "en");

    expect(card).toMatchObject({ kicker: "End of the tape", headlinePrefix: "Winner:", points: "pts", tracks: "10 tracks" });
    expect(card.date).toBe("Oct 28, 2026");
  });

  it("no lleva nada más que lo público", () => {
    const card = JSON.stringify(buildCardModel(result([player("Ana", 9)])));

    for (const secret of ["code", "filters", "trackName", "token", "userId", "guestId"]) expect(card).not.toContain(secret);
  });

  it("el plan B deja nombres con letras latinas y quita emoji y escrituras que las fuentes no cubren", () => {
    const card = plainCard(
      buildCardModel(result([player("Sofía 🦄", 9, { members: ["日本", "José"] }), player("田中", 4)])),
    );

    expect(card.headlineText).toBe("Sofía");
    expect(card.podium[0].members).toEqual(["·", "José"]);
    expect(card.podium[1].name).toBe("·");
  });
});
