import { AppError } from "@/lib/errors";
import type { OpenTrackSource } from "@/lib/game/open-picker";
import type { Track } from "@/lib/spotify/types";

/** Servidor de la vista previa de las canciones falsas: el navegador de las pruebas e2e lo intercepta. */
export const FAKE_PREVIEW_HOST = "audio-ssl.itunes.apple.com";

const SONGS: [title: string, artist: string][] = [
  ["Luna Llena", "Los Faroles"],
  ["Camino Largo", "Marta Olmo"],
  ["Ventana Azul", "Casa de Papel Sonora"],
  ["Playa de Noche", "Duo Marea"],
  ["Tren de Medianoche", "Los Faroles"],
  ["Cielo Abierto", "Marta Olmo"],
  ["Fuego Lento", "Trio Brasa"],
  ["Viento del Sur", "Casa de Papel Sonora"],
  ["Café y Lluvia", "Duo Marea"],
  ["Bailar Descalzos", "Trio Brasa"],
  ["Mapa de Estrellas", "Los Faroles"],
  ["Río Dorado", "Marta Olmo"],
  ["Sombra y Sol", "Casa de Papel Sonora"],
  ["Puerto Seguro", "Duo Marea"],
  ["Hojas Secas", "Trio Brasa"],
  ["Gran Verano", "Los Faroles"],
  ["Ola Perfecta", "Marta Olmo"],
  ["Calle Vieja", "Casa de Papel Sonora"],
  ["Postal Lejana", "Duo Marea"],
  ["Dulce Espera", "Trio Brasa"],
];

/**
 * Canciones inventadas para las pruebas e2e: así no se llama a iTunes (lento, limitado y distinto cada día).
 * Se activa solo con `E2E_FAKE_ITUNES=1` (ver `itunesSource` en `game/service.ts`); nunca se define en producción.
 */
export const FAKE_TRACKS: Track[] = SONGS.map(([name, artist], i) => ({
  id: `fake:${i + 1}`,
  uri: `fake:track:${i + 1}`,
  name,
  artists: [artist],
  artistIds: [],
  durationMs: 30_000,
  albumImage: null,
  popularity: null,
  isPlayable: true,
  previewUrl: `https://${FAKE_PREVIEW_HOST}/e2e/${i + 1}.m4a`,
  releaseYear: 2000 + i,
}));

/**
 * Palabra clave que hace que el iTunes falso responda como si nos estuviera limitando (429): así las e2e
 * comprueban qué ve la familia cuando pasa, sin provocarlo de verdad contra Apple.
 */
export const FAKE_RATE_LIMIT_KEYWORD = "e2e-itunes-limitado";

export const fakeItunesSource: OpenTrackSource = {
  search: async ({ term }) => {
    if (term.includes(FAKE_RATE_LIMIT_KEYWORD)) throw new AppError("ITUNES_RATE_LIMITED", 429);
    return FAKE_TRACKS;
  },
};
