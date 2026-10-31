import { describe, expect, it, vi } from "vitest";

// Las canciones inventadas de las e2e (20): así se elige de verdad, sin llamar a iTunes.
vi.hoisted(() => {
  process.env.E2E_FAKE_ITUNES = "1";
});

import { registerGuest } from "@/lib/access/guest";
import type { Owner } from "@/lib/access/owner";
import { db } from "@/lib/db";
import { FAKE_TRACKS } from "@/lib/itunes/fake";
import { createGame, recentlyHeardTrackIds, replayGame, revealRound, startNextRound } from "@/lib/game/service";

let n = 0;
async function newOwner(): Promise<Owner> {
  const { guest } = await registerGuest(`ip-fresh-${n++}`);
  return { kind: "guest", guestId: guest.id };
}

/** Una partida del dueño en la que sonaron `tracks`, creada `minutesAgo` minutos atrás. */
async function playedGame(owner: Owner, tracks: string[], minutesAgo: number, freshGames = 5) {
  const game = await createGame({ mode: "open", rounds: 10, players: ["Ana"], freshGames }, owner);
  const createdAt = new Date(Date.now() - minutesAgo * 60_000);
  await db.game.update({ where: { id: game.id }, data: { createdAt } });
  for (const [i, trackId] of tracks.entries()) {
    await db.round.create({
      data: { gameId: game.id, number: i + 1, trackId, trackUri: trackId, trackName: trackId, artists: "[]", durationMs: 30_000, startMs: 0 },
    });
  }
  return db.game.findUniqueOrThrow({ where: { id: game.id } });
}

describe("canciones ya oídas en otras partidas del mismo dueño", () => {
  it("junta las de las últimas N partidas, sin contar la actual", async () => {
    const owner = await newOwner();
    await playedGame(owner, ["vieja"], 60);
    await playedGame(owner, ["a", "b"], 30);
    await playedGame(owner, ["b", "c"], 20);
    const current = await playedGame(owner, ["actual"], 0, 2);

    expect([...(await recentlyHeardTrackIds(current))].sort()).toEqual(["a", "b", "c"]);
  });

  it("no mira las partidas de otro dueño", async () => {
    const mine = await newOwner();
    await playedGame(await newOwner(), ["ajena"], 10);
    const current = await playedGame(mine, [], 0);

    expect(await recentlyHeardTrackIds(current)).toEqual(new Set());
  });

  it("con «No» (0) no mira ninguna", async () => {
    const owner = await newOwner();
    await playedGame(owner, ["a"], 10);
    const current = await playedGame(owner, [], 0, 0);

    expect(await recentlyHeardTrackIds(current)).toEqual(new Set());
  });

  it("al jugar de verdad: la segunda partida no repite; la tercera, sin nuevas, repite de otras pero no dentro de ella", async () => {
    const owner = await newOwner();
    const half = FAKE_TRACKS.length / 2;
    const play = async () => {
      const game = await createGame({ mode: "open", rounds: half, players: ["Ana"] }, owner);
      const ids: string[] = [];
      for (let i = 0; i < half; i++) {
        const round = await startNextRound(game.id);
        ids.push((await db.round.findUniqueOrThrow({ where: { id: round.id } })).trackId);
        await revealRound(game.id, round.id);
      }
      return ids;
    };

    const first = await play();
    const second = await play();
    const third = await play();

    expect(second.filter((id) => first.includes(id))).toEqual([]);
    expect(new Set(third).size).toBe(half);
  });

  it("«Otra igual» conserva el ajuste", async () => {
    const owner = await newOwner();
    const game = await playedGame(owner, [], 0, 3);
    await db.game.update({ where: { id: game.id }, data: { status: "FINISHED" } });

    const next = await replayGame(game.id, owner);

    expect(next.freshGames).toBe(3);
  });
});
