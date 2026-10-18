/** Pista normalizada: solo lo que el juego necesita. */
export interface Track {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  artistIds: string[];
  durationMs: number;
  albumImage: string | null;
  popularity: number | null;
  /** Vista previa de 30 s (solo fuentes del modo abierto). */
  previewUrl?: string | null;
  /** Año de lanzamiento, si la fuente lo da (para filtrar por años en el modo abierto). */
  releaseYear?: number | null;
  /** `false` si no se puede reproducir en el mercado pedido; `null` si Spotify no lo indica. */
  isPlayable: boolean | null;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  owner: string;
  totalTracks: number | null;
  image: string | null;
  /** La cuenta se conectó sin el permiso necesario: hay que volver a iniciar sesión. */
  needsReconnect?: boolean;
  /**
   * false si es de otra persona: en modo desarrollo Spotify solo deja leer las playlists
   * propias o colaborativas (las demás devuelven 403).
   */
  readable: boolean;
}

/** Forma (parcial) de una pista en las respuestas de la Web API. */
export interface SpotifyTrackObject {
  id: string | null;
  uri: string;
  name: string;
  type?: string;
  is_local?: boolean;
  is_playable?: boolean;
  duration_ms: number;
  popularity?: number;
  artists: { id?: string | null; name: string }[];
  album?: { images?: { url: string; width?: number | null }[] };
}
