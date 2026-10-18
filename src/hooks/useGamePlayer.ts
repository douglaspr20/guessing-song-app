"use client";

import { usePreviewPlayer } from "./usePreviewPlayer";
import { useSpotifyPlayer } from "./useSpotifyPlayer";

/**
 * El reproductor que corresponde al modo de la partida. Los dos hooks se llaman siempre
 * (reglas de los hooks), pero solo el del modo activo carga algo: el SDK de Spotify no se
 * descarga en las partidas abiertas.
 */
export function useGamePlayer(mode: string | null) {
  const spotify = useSpotifyPlayer(mode === "spotify");
  const preview = usePreviewPlayer(mode === "open");
  return mode === "open" ? preview : spotify;
}

export type GamePlayer = ReturnType<typeof useGamePlayer>;
