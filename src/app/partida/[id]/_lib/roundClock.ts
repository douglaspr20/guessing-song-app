import { nextTierInMs, pointsForElapsed, type RoundRules } from "@/lib/game/scoring";
import type { FragmentPhase } from "@/hooks/useSpotifyPlayer";
import type { Round } from "@/lib/client/api";
import { game as esGame } from "@/i18n/messages/es/game";

export interface RoundClockInput {
  round: Round | null;
  fragmentSeconds: number;
  /** Tramos de puntos y pistas del modo de la partida. */
  rules: RoundRules;
  /** Cuándo llegó el estado del servidor (ms). */
  fetchedAt: number;
  /** Reloj de pantalla (ms); 0 antes del primer tick. */
  now: number;
  player: { phase: FragmentPhase; remainingMs: number; fragmentMs: number };
  /** Textos del contador en el idioma de la pantalla (`m.game.clock`); por defecto, en español. */
  text?: ClockText;
}

type ClockText = typeof esGame.clock;

export interface RoundClockView {
  open: boolean;
  started: boolean;
  elapsedMs: number;
  /** Lo que vale acertar el título ahora. */
  pointsNow: number;
  /** Cuánto falta para que baje el valor del título (null si ya vale 1). */
  nextDropInMs: number | null;
  /** El artista aún suma +1. */
  artistOpen: boolean;
  fragmentMs: number;
  /**
   * La ronda ya sonó pero esta pestaña no tiene audio (p. ej. tras recargar):
   * queda por oír lo que el reloj de la ronda aún no consumió.
   */
  orphan: boolean;
  orphanLeftMs: number;
  /** Hay que congelar el reloj del servidor para no perder puntos sin que suene nada. */
  needsFreeze: boolean;
  /** Tiempo restante a mostrar en el contador. */
  shownLeftMs: number;
  /** 0 al empezar el fragmento, 1 al acabar (posición de la cinta). */
  tapeProgress: number;
  /** El botón de pausa debe ofrecer «Seguir». */
  canResume: boolean;
  caption: string;
}

/** Deriva todo lo que la pantalla de juego necesita saber del reloj de la ronda. */
export function deriveRoundClock({
  round,
  fragmentSeconds,
  rules,
  fetchedAt,
  now,
  player,
  text = esGame.clock,
}: RoundClockInput): RoundClockView {
  const open = round?.status === "PLAYING";
  const started = !!round?.playStartedAt;
  const fragmentMs = fragmentSeconds * 1000;

  // Lo que dijo el servidor más lo que ha pasado desde entonces, si el reloj no está en pausa.
  const sinceFetch = round?.paused || !now ? 0 : Math.max(0, now - fetchedAt);
  const elapsedMs = started && open ? round!.elapsedMs + sinceFetch : (round?.elapsedMs ?? 0);

  const pointsNow = pointsForElapsed(elapsedMs, rules);
  const nextDropInMs = nextTierInMs(elapsedMs, rules);
  const artistOpen = !!round?.artistAvailable && elapsedMs < rules.hintAtMs.artist;

  const orphan = open && started && player.phase === "idle";
  const orphanLeftMs = orphan ? Math.max(0, fragmentMs - elapsedMs) : 0;
  const needsFreeze = orphan && !round?.paused && orphanLeftMs > 0;
  const canResume = player.phase === "paused" || (orphan && orphanLeftMs > 0);

  let tapeProgress = 0;
  if (orphan) tapeProgress = 1 - orphanLeftMs / (fragmentMs || 1);
  else if (player.fragmentMs) tapeProgress = 1 - player.remainingMs / player.fragmentMs;
  else if (open && started) tapeProgress = 1;

  return {
    open,
    started,
    elapsedMs,
    pointsNow,
    nextDropInMs,
    artistOpen,
    fragmentMs,
    orphan,
    orphanLeftMs,
    needsFreeze,
    shownLeftMs: orphan ? orphanLeftMs : player.remainingMs,
    tapeProgress,
    canResume,
    caption: round?.buzz ? text.answering(round.buzz.name || text.someone) : captionFor(started, canResume, player.phase, text),
  };
}

function captionFor(started: boolean, canResume: boolean, phase: FragmentPhase, text: ClockText): string {
  if (!started) return text.notStarted;
  if (canResume) return text.paused;
  if (phase === "ended" || phase === "idle") return text.ended;
  return text.left;
}
