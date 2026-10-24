import { describe, expect, it } from "vitest";
import { FAKE_TRACKS, FAKE_PREVIEW_HOST, fakeItunesSource } from "@/lib/itunes/fake";
import { pickOpenTrack } from "@/lib/game/open-picker";
import { createGameSchema } from "@/lib/game/filters";

describe("canciones falsas para e2e", () => {
  it("son únicas y tienen vista previa en el servidor que interceptan las pruebas", () => {
    expect(new Set(FAKE_TRACKS.map((t) => t.id)).size).toBe(FAKE_TRACKS.length);
    expect(new Set(FAKE_TRACKS.map((t) => t.name)).size).toBe(FAKE_TRACKS.length);
    for (const t of FAKE_TRACKS) expect(new URL(t.previewUrl!).host).toBe(FAKE_PREVIEW_HOST);
  });

  it("el selector del modo abierto las acepta y no repite", async () => {
    const filters = createGameSchema.parse({ mode: "open", players: ["Ana", "Luis"], rounds: 3 }).filters;
    const used = new Set<string>();
    for (let i = 0; i < FAKE_TRACKS.length; i++) {
      const picked = await pickOpenTrack({ filters, usedTrackIds: used, source: fakeItunesSource });
      expect(used.has(picked.track.id)).toBe(false);
      used.add(picked.track.id);
    }
  });
});
