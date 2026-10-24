import type { HintType, RoundRules } from "@/lib/game/scoring";

/** Cuenta atrás entre rondas, para dar emoción. */
export const INTERMISSION_MS = 3000;
/** Cuánto se marca en el marcador la fila del jugador que acaba de sumar. */
export const GAIN_FLASH_MS = 2400;
/** Cuánto se espera, tras acabarse el tiempo de quien pulsó, antes de cerrarle el turno desde la tele (da margen a su móvil). */
export const BUZZ_EXPIRE_DELAY_MS = 2500;
/** Margen tras la hora prevista de una pista antes de pedirla al servidor. */
export const HINT_REFRESH_DELAY_MS = 200;

const HINT_LABELS: Record<HintType, string> = { words: "Palabras", artist: "Artista", letters: "Letras" };

/** Las tres marcas de pista del casete, con el segundo en que sale cada una según las reglas de la partida. */
export function hintSlots(rules: RoundRules) {
  return (Object.keys(HINT_LABELS) as HintType[]).map((key) => ({
    key,
    label: HINT_LABELS[key],
    at: `${rules.hintAtMs[key] / 1000} s`,
  }));
}
