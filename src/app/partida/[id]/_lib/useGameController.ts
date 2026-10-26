"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGamePlayer } from "@/hooks/useGamePlayer";
import { rulesFor } from "@/lib/game/scoring";
import { TEAM_COLORS } from "@/lib/game/teams";
import { api, type GuessResult, type GuessRow, type Round } from "@/lib/client/api";
import { useLiveGame, type LiveEvent } from "@/lib/client/live";
import { useI18n } from "@/i18n/client";
import { compareText } from "@/i18n/format";
import { BUZZ_EXPIRE_DELAY_MS, GAIN_FLASH_MS, INTERMISSION_MS } from "./constants";
import { acceptedFeedback, buzzFeedback, describeGuess, spokenFeedback, type Feedback } from "./feedback";
import { deriveRoundClock } from "./roundClock";
import { useGame, useNow } from "./useGame";

export interface Intermission {
  number: number;
  endsAt: number;
}

export interface GuessInput {
  playerId: string;
  title: string;
  artist: string;
}

/**
 * Orquesta una partida en el dispositivo anfitrión: estado del servidor, reproductor, reloj
 * de la ronda y las acciones del anfitrión (empezar, repetir, pausar, revelar, registrar).
 */
export function useGameController(gameId: string) {
  const { m, locale } = useI18n();
  const fb = m.game.feedback;
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
  const roundId = round?.id;
  /** Quien pulsó «¡Lo sé!» desde el móvil y está respondiendo (la canción está en pausa). */
  const buzz = round?.status === "PLAYING" ? (round.buzz ?? null) : null;
  const buzzLeftMs = buzz ? Math.max(0, buzz.remainingMs - (now && fetchedAt ? now - fetchedAt : 0)) : 0;
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
  const paletteOrder = (c: string | null) => TEAM_COLORS.findIndex((t) => t.key === c);
  const seats = [...(game?.players ?? [])].sort(
    game?.format === "teams"
      ? (a, b) => paletteOrder(a.color) - paletteOrder(b.color)
      : (a, b) => compareText(locale)(a.name, b.name),
  );
  // Quién respondió: lo usan el formulario, «¡Acertó!» y los atajos. Por defecto, la primera ficha.
  const [selectedId, setSelectedId] = useState("");
  const selectedPlayer = seats.find((p) => p.id === selectedId) ?? seats[0] ?? null;

  const finished = !!game && (game.status === "FINISHED" || game.currentRound >= game.totalRounds);
  const ready = player.status === "ready";
  const roundOpen = !!round && clock.open;
  /** Qué se puede hacer ahora mismo: lo comparten los botones y los atajos. */
  const can = {
    next: !roundOpen && (finished || (!busy && ready)),
    play: roundOpen && !busy && ready && !buzz,
    pause: roundOpen && !busy && !buzz && (player.phase === "playing" || clock.canResume),
    reveal: roundOpen && !busy,
    awardTitle: roundOpen && clock.started && !busy && !!selectedPlayer && !round?.winnerPlayerId,
    awardArtist: roundOpen && clock.started && !busy && !!selectedPlayer && clock.artistOpen,
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

  // Se relee el estado ante cualquier aviso, de uno en uno: si llega otro mientras se lee, se vuelve a leer al acabar.
  const reading = useRef(false);
  const readAgain = useRef(false);
  const readState = useCallback(async () => {
    if (reading.current) {
      readAgain.current = true;
      return;
    }
    reading.current = true;
    try {
      do {
        readAgain.current = false;
        await refresh().catch(() => {});
      } while (readAgain.current);
    } finally {
      reading.current = false;
    }
  }, [refresh]);

  // El último aviso, para quien necesite reaccionar (la lista de conectados).
  const [liveEvent, setLiveEvent] = useState<LiveEvent | null>(null);
  const liveStatus = useLiveGame(
    gameId,
    (e) => {
      if (e.type === "buzz") setFeedback(null);
      if (e.type === "buzz_resolved") setFeedback(buzzFeedback(e, fb));
      setLiveEvent(e);
      readState();
    },
    !!game && !loadError,
  );

  // Alguien pulsa: la música se para; acaba su turno sin ganar: sigue sola. Si la ronda se cierra, se corta.
  const pausedByBuzz = useRef<string | null>(null);
  const buzzId = buzz?.participantId ?? null;
  const roundStatus = round?.status;
  const roundPaused = round?.paused;
  useEffect(() => {
    if (!roundId) return;
    if (roundStatus === "PLAYING" && buzzId) {
      if (player.phase === "playing") {
        pausedByBuzz.current = roundId;
        void player.pause();
      }
      return;
    }
    if (pausedByBuzz.current === roundId) {
      pausedByBuzz.current = null;
      if (roundStatus === "PLAYING" && !roundPaused && player.phase === "paused") {
        player.resume().catch((e: Error) => setActionError(e.message));
      }
    }
    if (roundStatus && roundStatus !== "PLAYING" && (player.phase === "playing" || player.phase === "paused")) {
      void player.stop();
    }
    // `player` cambia en cada render: solo importan su fase y lo que dice el servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buzzId, roundId, roundStatus, roundPaused, player.phase]);

  // Si el móvil de quien pulsó no responde, la tele cierra su turno poco después de acabarse el tiempo.
  const buzzMsAtFetch = buzz?.remainingMs ?? 0;
  useEffect(() => {
    if (!buzzId || !roundId) return;
    const wait = Math.max(0, buzzMsAtFetch - (Date.now() - fetchedAt)) + BUZZ_EXPIRE_DELAY_MS;
    const t = setTimeout(() => {
      api(`/api/games/${gameId}/rounds/${roundId}/buzz`, { json: { mode: "expire" } })
        .catch(() => {})
        .finally(readState);
    }, wait);
    return () => clearTimeout(t);
    // Un turno nuevo (otra persona o ronda) reprograma el cierre; leer otra vez el mismo no.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buzzId, roundId]);

  // Al recargar a mitad de una ronda el audio se corta: se pausa el reloj para no perder puntos.
  useEffect(() => {
    if (!clock.needsFreeze || !roundId) return;
    api(`/api/games/${gameId}/rounds/${roundId}/pause`, { method: "POST" })
      .then(() => refresh())
      .catch(() => {});
  }, [clock.needsFreeze, roundId, gameId, refresh]);

  // Next mantiene viva esta pantalla al ir a la estantería (<Activity>) y, al ocultarla, los
  // reproductores cortan el audio. Si estaba sonando, se pausa también el reloj del servidor (para
  // no perder puntos) y al volver con «Seguir jugando» la canción sigue sola desde donde iba.
  const latest = useRef({ gameId, round, player, refresh });
  useEffect(() => {
    latest.current = { gameId, round, player, refresh };
  });
  const pausedOnLeave = useRef<string | null>(null);
  useEffect(() => {
    // Se reanuda en el siguiente turno: al reaparecer, React (en desarrollo) monta, desmonta y vuelve
    // a montar los efectos, y el desmontaje intermedio del reproductor cortaría el audio recién retomado.
    const resumeTimer = pausedOnLeave.current
      ? setTimeout(() => {
          const leftRoundId = pausedOnLeave.current;
          pausedOnLeave.current = null;
          const { gameId, round, player, refresh } = latest.current;
          if (!leftRoundId || round?.id !== leftRoundId || round.status !== "PLAYING" || player.phase !== "paused") return;
          player
            .resume()
            .then(() => api(`/api/games/${gameId}/rounds/${leftRoundId}/resume`, { method: "POST" }))
            .then(() => refresh())
            .catch((e: Error) => setActionError(e.message));
        }, 0)
      : null;
    return () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      const { gameId, round, player } = latest.current;
      if (player.phase !== "playing" || round?.status !== "PLAYING") return;
      pausedOnLeave.current = round.id;
      void player.pause();
      api(`/api/games/${gameId}/rounds/${round.id}/pause`, { method: "POST" }).catch(() => {});
    };
  }, []);

  // Fin del entreacto: suena la pista.
  useEffect(() => {
    if (!intermission || !roundId) return;
    const t = setTimeout(async () => {
      setIntermission(null);
      try {
        await player.playFragment(gameId, roundId);
        await refresh();
      } catch (e) {
        setActionError((e as Error).message);
      }
    }, Math.max(0, intermission.endsAt - Date.now()));
    return () => clearTimeout(t);
    // Solo depende del entreacto programado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intermission]);

  const startNext = () =>
    run(async () => {
      await player.activate(); // dentro del clic: el audio podrá sonar tras el entreacto
      await player.stop();
      setFeedback(null);
      const r = await api<Round>(`/api/games/${gameId}/rounds`, { method: "POST" });
      await refresh();
      setIntermission({ number: r.number, endsAt: Date.now() + INTERMISSION_MS });
    });

  const replay = () =>
    run(async () => {
      if (!round) return;
      await player.activate();
      await player.playFragment(gameId, round.id);
      await refresh();
    });

  const togglePause = () =>
    run(async () => {
      if (!round) return;
      if (clock.orphan) {
        // Retoma el fragmento donde se quedó; el servidor reanuda el reloj.
        await player.activate();
        await player.playFragment(gameId, round.id, clock.fragmentMs - clock.orphanLeftMs);
      } else if (player.phase === "paused") {
        await player.resume();
        await api(`/api/games/${gameId}/rounds/${round.id}/resume`, { method: "POST" });
      } else {
        await player.pause();
        await api(`/api/games/${gameId}/rounds/${round.id}/pause`, { method: "POST" });
      }
      await refresh();
    });

  const reveal = () =>
    run(async () => {
      if (!round) return;
      await player.stop();
      await api(`/api/games/${gameId}/rounds/${round.id}/reveal`, { method: "POST" });
      await refresh();
    });

  /** Registra una respuesta. Devuelve true si se envió (para limpiar el formulario). */
  const submitGuess = async ({ playerId, title, artist }: GuessInput): Promise<boolean> => {
    if (!round || !game) return false;
    let sent = false;
    await run(async () => {
      const name = game.players.find((p) => p.id === playerId)?.name ?? "";
      const r = await api<GuessResult>(`/api/games/${gameId}/rounds/${round.id}/guesses`, {
        json: { playerId, title: title.trim() || undefined, artist: artist.trim() || undefined },
      });
      sent = true;
      setFeedback(describeGuess(name, r, { title: !!title.trim(), artist: !!artist.trim() }, fb));
      if (r.points) flashGain(playerId, r.points);
      if (r.titleAwarded) await player.stop();
      await refresh();
    });
    return sent;
  };

  /** El jugador elegido dijo la canción o el artista en voz alta: se le da sin escribir nada. */
  const awardSpoken = (part: "title" | "artist") =>
    run(async () => {
      if (!round || !game || !selectedPlayer) return;
      const r = await api<GuessResult>(`/api/games/${gameId}/rounds/${round.id}/award`, {
        json: { playerId: selectedPlayer.id, [part]: true },
      });
      setFeedback(spokenFeedback(selectedPlayer.name, part, r.points, fb));
      flashGain(selectedPlayer.id, r.points);
      if (r.titleAwarded) await player.stop();
      await refresh();
    });

  /** La tele cierra el turno de quien pulsó: lo da por fallado o lo cancela sin dejarle fuera. */
  const resolveBuzz = (mode: "fail" | "cancel") =>
    run(async () => {
      if (!round) return;
      await api(`/api/games/${gameId}/rounds/${round.id}/buzz`, { json: { mode } });
      await refresh();
    });

  /** Quien tiene el turno lo dijo en voz alta y era correcto: se le da la canción. */
  const awardBuzzer = () =>
    run(async () => {
      if (!round || !buzz?.playerId) return;
      const r = await api<GuessResult>(`/api/games/${gameId}/rounds/${round.id}/award`, {
        json: { playerId: buzz.playerId, title: true },
      });
      const owner = game?.players.find((p) => p.id === buzz.playerId)?.name ?? buzz.name;
      setFeedback(spokenFeedback(owner, "title", r.points, fb));
      flashGain(buzz.playerId, r.points);
      await player.stop();
      await refresh();
    });

  /** El anfitrión da por bueno el título o el artista de un intento rechazado. */
  const acceptGuess = (guess: GuessRow, part: "title" | "artist") =>
    run(async () => {
      if (!round) return;
      const r = await api<{ points: number; titleAwarded: boolean }>(
        `/api/games/${gameId}/rounds/${round.id}/guesses/${guess.id}/accept`,
        { json: { [part]: true } },
      );
      setFeedback(acceptedFeedback(guess.playerName, r.points, fb));
      flashGain(guess.playerId, r.points);
      if (r.titleAwarded) await player.stop();
      await refresh();
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
    liveEvent,
    liveStatus,
    actions: {
      startNext,
      /** Empezar, siguiente pista o, si ya no quedan, el podio. */
      primary: () => (finished ? setShowFinale(true) : startNext()),
      replay,
      togglePause,
      reveal,
      submitGuess,
      acceptGuess,
      resolveBuzz,
      awardBuzzer,
      awardTitle: () => awardSpoken("title"),
      awardArtist: () => awardSpoken("artist"),
    },
  };
}

export type GameController = ReturnType<typeof useGameController>;
