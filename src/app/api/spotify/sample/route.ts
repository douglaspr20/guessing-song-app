import { z } from "zod";
import { handle } from "@/lib/errors";
import { gameFiltersSchema, MIN_FRAGMENT_SECONDS } from "@/lib/game/filters";
import { spotifySource } from "@/lib/game/service";
import { pickTrack } from "@/lib/game/track-picker";
import { PLAYLIST_PAGE_SIZE, SEARCH_MAX_OFFSET, SEARCH_PAGE_SIZE } from "@/lib/spotify/sources";

const bodySchema = z.object({
  filters: gameFiltersSchema,
  fragmentSeconds: z.number().int().min(MIN_FRAGMENT_SECONDS).default(MIN_FRAGMENT_SECONDS),
});

/**
 * Prueba unos filtros sin crear partida: devuelve la canción que saldría.
 * Útil para comprobar que un género/idioma/playlist da resultados.
 */
export const POST = handle(async (req: Request) => {
  const { filters, fragmentSeconds } = bodySchema.parse(await req.json());
  const picked = await pickTrack({
    filters,
    fragmentMs: fragmentSeconds * 1000,
    usedTrackIds: new Set(),
    source: spotifySource,
    searchPageSize: SEARCH_PAGE_SIZE,
    playlistPageSize: PLAYLIST_PAGE_SIZE,
    maxSearchOffset: SEARCH_MAX_OFFSET,
  });
  return Response.json(picked);
});
