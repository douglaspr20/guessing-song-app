import { HINT_INTERVAL_MS } from "@/lib/game/scoring";

/** Cuenta atrás entre rondas, para dar emoción. */
export const INTERMISSION_MS = 3000;
/** El punto de artista solo vale antes de que salga su pista. */
export const ARTIST_DEADLINE_MS = 2 * HINT_INTERVAL_MS;
/** Cuánto se marca en el marcador la fila del jugador que acaba de sumar. */
export const GAIN_FLASH_MS = 2400;
/** Margen tras la hora prevista de una pista antes de pedirla al servidor. */
export const HINT_REFRESH_DELAY_MS = 200;

/** Las tres marcas de pista del casete, en orden de aparición. */
export const HINT_SLOTS = [
  { key: "words", label: "Palabras", at: "20 s" },
  { key: "artist", label: "Artista", at: "40 s" },
  { key: "letters", label: "Letras", at: "60 s" },
] as const;
