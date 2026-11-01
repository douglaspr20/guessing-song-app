import { describe, expect, it, vi } from "vitest";

// Las canciones inventadas de las e2e (20, de los años 2000 a 2019): así se elige de verdad, sin llamar a iTunes.
vi.hoisted(() => {
  process.env.E2E_FAKE_ITUNES = "1";
});

import { registerGuest } from "@/lib/access/guest";
import type { Owner } from "@/lib/access/owner";
import { db } from "@/lib/db";
import { createGame, getGame, startNextRound } from "@/lib/game/service";

let n = 0;
async function newOwner(): Promise<Owner> {
  const { guest } = await registerGuest(`ip-fallback-${n++}`);
  return { kind: "guest", guestId: guest.id };
}

describe("respaldo al empezar una ronda", () => {
  it("con años imposibles la ronda empieza igual, sin los años, y queda anotado para la tele", async () => {
    const game = await createGame(
      { mode: "open", rounds: 2, players: ["Ana"], filters: { source: "search", genres: [], playlistIds: [], yearFrom: 1900, yearTo: 1901 } },
      await newOwner(),
    );

    const round = await startNextRound(game.id);

    expect(round.relaxed).toEqual(["years"]);
    expect((await db.round.findUniqueOrThrow({ where: { id: round.id } })).relaxed).toBe('["years"]');
    expect((await getGame(game.id)).round?.relaxed).toEqual(["years"]);
  });

  it("con filtros que sí dan canciones no se afloja nada", async () => {
    const game = await createGame({ mode: "open", rounds: 2, players: ["Ana"] }, await newOwner());
    const round = await startNextRound(game.id);
    expect(round.relaxed).toEqual([]);
  });

  it("con un artista elegido, todas las pistas son suyas", async () => {
    const game = await createGame(
      { mode: "open", rounds: 3, players: ["Ana"], filters: { source: "search", genres: [], playlistIds: [], artists: [{ id: "itunes:name:los faroles", name: "Los Faroles" }] } },
      await newOwner(),
    );
    const round = await startNextRound(game.id);
    const row = await db.round.findUniqueOrThrow({ where: { id: round.id } });
    expect(JSON.parse(row.artists)).toEqual(["Los Faroles"]);
    expect(round.relaxed).toEqual([]);
  });
});
