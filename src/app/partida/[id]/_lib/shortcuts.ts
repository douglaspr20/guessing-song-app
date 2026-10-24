/**
 * Atajos de la pantalla de juego para jugar en la tele: teclado inalámbrico o el mando de la Smart TV
 * (o del Chromecast). Esta parte es pura: traduce una tecla a una acción; el hook decide si se puede.
 */

export type ShortcutAction =
  | "pause"
  | "play"
  | "reveal"
  | "awardTitle"
  | "awardArtist"
  | "next"
  | "help"
  | "leaveField"
  | { player: number };

/** Lo que importa de un `KeyboardEvent` (así se puede probar sin DOM). */
export interface KeyInput {
  key: string;
  keyCode?: number;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
}

export interface KeyContext {
  /** El foco está en un campo de texto: las letras se escriben. */
  typing: boolean;
  /** El foco está en un botón o enlace: Espacio ya tiene su efecto nativo. */
  onControl: boolean;
}

// Mandos de tele: webOS (LG) y Tizen (Samsung) no siempre traen `key`, pero sí estos códigos.
const KEYCODE: Record<number, ShortcutAction> = {
  403: "reveal", // rojo
  404: "awardTitle", // verde
  405: "awardArtist", // amarillo
  406: "next", // azul
  461: "leaveField", // Atrás (webOS)
  10009: "leaveField", // Atrás (Tizen)
  415: "pause", // Play
  19: "pause", // Pausa
  10252: "pause", // Play/Pausa (Tizen)
  417: "next", // Avance rápido
  412: "play", // Rebobinar
};

// Teclas multimedia y del mando: valen siempre, incluso escribiendo.
const MEDIA: Record<string, ShortcutAction> = {
  MediaPlayPause: "pause",
  MediaPlay: "pause",
  MediaPause: "pause",
  MediaTrackNext: "next",
  MediaFastForward: "next",
  MediaTrackPrevious: "play",
  MediaRewind: "play",
  ColorF0Red: "reveal",
  ColorF1Green: "awardTitle",
  ColorF2Yellow: "awardArtist",
  ColorF3Blue: "next",
};

const LETTERS: Record<string, ShortcutAction> = {
  p: "pause",
  r: "play",
  v: "reveal",
  c: "awardTitle",
  a: "awardArtist",
  n: "next",
  h: "help",
  "?": "help",
};

export function shortcutFor(e: KeyInput, { typing, onControl }: KeyContext): ShortcutAction | null {
  if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return null;

  if (e.key === "Escape" || e.key === "GoBack" || e.key === "BrowserBack") return typing ? "leaveField" : null;
  const media = MEDIA[e.key] ?? (e.keyCode ? KEYCODE[e.keyCode] : undefined);
  if (media) {
    // Atrás fuera de un campo no hace nada: no se sale de la partida por error.
    if (media === "leaveField") return typing ? "leaveField" : null;
    return media;
  }
  if (typing) return null;

  if (e.key === " ") return onControl ? null : "pause";
  if (/^[1-9]$/.test(e.key)) return { player: Number(e.key) - 1 };
  return LETTERS[e.key.toLowerCase()] ?? null;
}

/** Texto de cada atajo, para la ayuda y las marcas de los botones. */
export const SHORTCUT_HELP: {
  action: string;
  keys: string[];
  remote: string;
  color?: "red" | "green" | "yellow" | "blue";
}[] = [
  { action: "Pausar o seguir (o reproducir si aún no ha sonado)", keys: ["Espacio", "P"], remote: "Play/Pausa" },
  { action: "Repetir el fragmento", keys: ["R"], remote: "Rebobinar" },
  { action: "Revelar la canción", keys: ["V"], remote: "Rojo", color: "red" },
  { action: "¡Acertó la canción! (al jugador elegido)", keys: ["C"], remote: "Verde", color: "green" },
  { action: "¡Acertó el artista! (al jugador elegido)", keys: ["A"], remote: "Amarillo", color: "yellow" },
  { action: "Empezar, siguiente pista o podio", keys: ["N"], remote: "Azul / Avance", color: "blue" },
  { action: "Elegir jugador", keys: ["1 … 9"], remote: "1 … 9" },
  { action: "Salir del campo de texto", keys: ["Esc"], remote: "Atrás" },
  { action: "Ver estos atajos", keys: ["?", "H"], remote: "" },
];
