"use client";

import { useState } from "react";
import { useGamePlayer } from "@/hooks/useGamePlayer";
import { useNow, remainingMs } from "@/hooks/useNow";
import { useI18n } from "@/i18n/client";
import { compareText } from "@/i18n/format";
import { useLiveGame, type LiveEvent } from "@/lib/client/live";
import { rulesFor } from "@/lib/game/scoring";
import { byPalette } from "@/lib/game/standings";
import { GAIN_FLASH_MS } from "../_lib/constants";
import { buzzFeedback, type Feedback } from "../_lib/feedback";
import { deriveRoundClock } from "../_lib/roundClock";
import { useGame } from "./useGame";
import { useHostActions } from "./useHostActions";
import { usePlayerSync, type Intermission } from "./usePlayerSync";
import { useSerializedRefresh } from "./useSerializedRefresh";

export type { GuessInput } from "./useHostActions";
export type { Intermission } from "./usePlayerSync";

/**
 * Orquesta una partida en el dispositivo anfitrión: estado del servidor, reproductor, reloj
 * de la ronda y las acciones del anfitrión (empezar, repetir, pausar, revelar, registrar).
 */
export function useGameController(gameId: string) {
  const { m, locale } = useI18n();
  const [showFinale, setShowFinale] = useState(false);
  const { game, guesses, fetchedAt, loadError, retryLoad, refresh } = useGame(gameId, (g) => {
    // Una partida terminada se abre directamente en el podio.
    if (g.status === "FINISHED" && g.round?.status !== "PLAYING") setShowFinale(true);
  });
  // Spotify (SDK) o vista previa de iTunes (<audio>), según el modo de la partida.
  const player = useGamePlayer(game?.mode ?? null);
  const rules = rulesFor(game?.mode);
  const now = useNow();

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [intermission, setIntermission] = useState<Intermission | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [gains, setGains] = useState<Record<string, number>>({});

  const round = game?.round ?? null;
  /** Quien pulsó «¡Lo sé!» desde el móvil y está respondiendo (la canción está en pausa). */
  const buzz = round?.status === "PLAYING" ? (round.buzz ?? null) : null;
  const buzzLeftMs = buzz ? remainingMs(buzz.remainingMs, fetchedAt, now) : 0;
  const clock = deriveRoundClock({
    round,
    fragmentSeconds: game?.fragmentSeconds ?? 0,
    rules,
    fetchedAt,
    now,
    player,
    text: m.game.clock,
  });

  // Las fichas van en orden fijo (el marcador se reordena por puntos): la tecla 1 siempre es el mismo jugador.
  const seats = [...(game?.players ?? [])].sort(
    game?.format === "teams" ? byPalette : (a, b) => compareText(locale)(a.name, b.name),
  );
  // Quién respondió: lo usan el formulario, «¡Acertó!» y los atajos. Por defecto, la primera ficha.
  const [selectedId, setSelectedId] = useState("");
  const selectedPlayer = seats.find((p) => p.id === selectedId) ?? seats[0] ?? null;

  const finished = !!game && (game.status === "FINISHED" || game.currentRound >= game.totalRounds);
  const ready = player.status === "ready";
  const roundOpen = !!round && clock.open;
  /** El anfitrión también juega desde aquí (con qué nombre), o null. */
  const hostSeat = game?.hostSeat ?? null;
  /** Es el turno del propio anfitrión: lo juzga el servidor, así que no puede darse los puntos a mano. */
  const ownTurn = !!buzz && !!hostSeat && buzz.participantId === hostSeat.id;
  /** Qué se puede hacer ahora mismo: lo comparten los botones y los atajos. */
  const can = {
    next: !roundOpen && (finished || (!busy && ready)),
    play: roundOpen && !busy && ready && !buzz,
    pause: roundOpen && !busy && !buzz && (player.phase === "playing" || clock.canResume),
    reveal: roundOpen && !busy && !ownTurn,
    awardTitle: roundOpen && clock.started && !busy && !!selectedPlayer && !round?.winnerPlayerId && !ownTurn,
    awardArtist: roundOpen && clock.started && !busy && !!selectedPlayer && clock.artistOpen && !ownTurn,
  };

  /** Ejecuta una acción del anfitrión bloqueando los botones y mostrando su error. */
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const flashGain = (playerId: string, points: number) => {
    setGains({ [playerId]: points });
    setTimeout(() => setGains({}), GAIN_FLASH_MS);
  };

  // ---------- Tiempo real: lo que pasa en los móviles ----------
  const readState = useSerializedRefresh(refresh);
  // El último aviso, para quien necesite reaccionar (la lista de conectados).
  const [liveEvent, setLiveEvent] = useState<LiveEvent | null>(null);
  const liveStatus = useLiveGame(
    gameId,
    (e) => {
      if (e.type === "buzz") setFeedback(null);
      if (e.type === "buzz_resolved") setFeedback(buzzFeedback(e, m.game.feedback));
      setLiveEvent(e);
      readState();
    },
    !!game && !loadError,
  );

  usePlayerSync({
    gameId,
    round,
    fetchedAt,
    player,
    clock,
    intermission,
    endIntermission: () => setIntermission(null),
    refresh,
    readState,
    onError: setActionError,
  });

  const actions = useHostActions({
    gameId,
    game,
    round,
    clock,
    player,
    selectedPlayer,
    refresh,
    run,
    setFeedback,
    flashGain,
    startIntermission: setIntermission,
    text: m.game.feedback,
  });

  return {
    game,
    round,
    guesses,
    loadError,
    retryLoad,
    refresh,
    player,
    rules,
    clock,
    now,
    busy,
    actionError,
    intermission,
    feedback,
    gains,
    showFinale,
    openFinale: () => setShowFinale(true),
    finished,
    seats,
    selectedPlayer,
    selectPlayer: setSelectedId,
    can,
    buzz,
    buzzLeftMs,
    hostSeat,
    ownTurn,
    fetchedAt,
    liveEvent,
    liveStatus,
    actions: {
      ...actions,
      /** Empezar, siguiente pista o, si ya no quedan, el podio. */
      primary: () => (finished ? setShowFinale(true) : actions.startNext()),
    },
  };
}

export type GameController = ReturnType<typeof useGameController>;
