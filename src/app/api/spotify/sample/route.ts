import { z } from "zod";
import { recordOwnerFilterTest } from "@/lib/access/limits";
import { requireOwner } from "@/lib/access/owner";
import { requireUser } from "@/lib/access/session";
import { handle } from "@/lib/errors";
import { gameFiltersSchema, gameModeSchema, MIN_FRAGMENT_SECONDS, OPEN_FRAGMENT_SECONDS } from "@/lib/game/filters";
import { pickOpenTrack } from "@/lib/game/open-picker";
import { itunesSource, spotifySourceFor } from "@/lib/game/service";
import { pickTrack } from "@/lib/game/track-picker";
import { PLAYLIST_PAGE_SIZE, SEARCH_MAX_OFFSET, SEARCH_PAGE_SIZE } from "@/lib/spotify/sources";

const bodySchema = z.object({
  mode: gameModeSchema.default("spotify"),
  filters: gameFiltersSchema,
  fragmentSeconds: z.number().int().min(OPEN_FRAGMENT_SECONDS).default(MIN_FRAGMENT_SECONDS),
});

/**
 * Prueba unos filtros sin crear partida: devuelve la canción que saldría.
 * Útil para comprobar que un género/idioma/playlist da resultados. En modo abierto busca en iTunes.
 */
export const POST = handle(async (req: Request) => {
  const { mode, filters, fragmentSeconds } = bodySchema.parse(await req.json());
  if (mode === "open") {
    await recordOwnerFilterTest(await requireOwner());
    return Response.json(await pickOpenTrack({ filters, usedTrackIds: new Set(), source: itunesSource }));
  }
  const user = await requireUser();
  const picked = await pickTrack({
    filters,
    fragmentMs: fragmentSeconds * 1000,
    usedTrackIds: new Set(),
    source: spotifySourceFor(user.id),
    searchPageSize: SEARCH_PAGE_SIZE,
    playlistPageSize: PLAYLIST_PAGE_SIZE,
    maxSearchOffset: SEARCH_MAX_OFFSET,
  });
  return Response.json(picked);
});
