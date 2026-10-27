"use client";

import type { useGamePlayer } from "@/hooks/useGamePlayer";
import type { Messages } from "@/i18n/messages";
import { api, type Game, type GuessResult, type GuessRow, type Player, type Round } from "@/lib/client/api";
import { INTERMISSION_MS } from "../_lib/constants";
import { acceptedFeedback, describeGuess, spokenFeedback, type Feedback } from "../_lib/feedback";
import type { Intermission } from "./usePlayerSync";
import type { RoundClockView } from "../_lib/roundClock";

export interface GuessInput {
  playerId: string;
  title: string;
  artist: string;
}

interface HostActionsContext {
  gameId: string;
  game: Game | null;
  round: Round | null;
  clock: RoundClockView;
  player: ReturnType<typeof useGamePlayer>;
  selectedPlayer: Player | null;
  refresh: () => Promise<unknown>;
  /** Ejecuta una acción bloqueando los botones y mostrando su error. */
  run: (fn: () => Promise<void>) => Promise<void>;
  setFeedback: (feedback: Feedback | null) => void;
  flashGain: (playerId: string, points: number) => void;
  startIntermission: (intermission: Intermission) => void;
  text: Messages["game"]["feedback"];
}

/** Lo que hace el anfitrión desde la tele: empezar, repetir, pausar, revelar, registrar y dar puntos. */
export function useHostActions(ctx: HostActionsContext) {
  const { gameId, game, round, clock, player, selectedPlayer, refresh, run, setFeedback, flashGain, startIntermission, text } = ctx;
  const roundUrl = round ? `/api/games/${gameId}/rounds/${round.id}` : null;

  /** Tras sumar puntos: el mensaje para la sala, el destello en el marcador y, si se acertó la canción, se corta. */
  const applyScore = async (feedback: Feedback, playerId: string, points: number, titleAwarded: boolean) => {
    setFeedback(feedback);
    if (points) flashGain(playerId, points);
    if (titleAwarded) await player.stop();
    await refresh();
  };

  const startNext = () =>
    run(async () => {
      await player.activate(); // dentro del clic: el audio podrá sonar tras el entreacto
      await player.stop();
      setFeedback(null);
      const r = await api<Round>(`/api/games/${gameId}/rounds`, { method: "POST" });
      await refresh();
      startIntermission({ number: r.number, endsAt: Date.now() + INTERMISSION_MS });
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
      if (!round || !roundUrl) return;
      if (clock.orphan) {
        // Retoma el fragmento donde se quedó; el servidor reanuda el reloj.
        await player.activate();
        await player.playFragment(gameId, round.id, clock.fragmentMs - clock.orphanLeftMs);
      } else if (player.phase === "paused") {
        await player.resume();
        await api(`${roundUrl}/resume`, { method: "POST" });
      } else {
        await player.pause();
        await api(`${roundUrl}/pause`, { method: "POST" });
      }
      await refresh();
    });

  const reveal = () =>
    run(async () => {
      if (!roundUrl) return;
      await player.stop();
      await api(`${roundUrl}/reveal`, { method: "POST" });
      await refresh();
    });

  /** Registra una respuesta. Devuelve true si se envió (para limpiar el formulario). */
  const submitGuess = async ({ playerId, title, artist }: GuessInput): Promise<boolean> => {
    if (!roundUrl || !game) return false;
    let sent = false;
    await run(async () => {
      const name = game.players.find((p) => p.id === playerId)?.name ?? "";
      const r = await api<GuessResult>(`${roundUrl}/guesses`, {
        json: { playerId, title: title.trim() || undefined, artist: artist.trim() || undefined },
      });
      sent = true;
      const said = { title: !!title.trim(), artist: !!artist.trim() };
      await applyScore(describeGuess(name, r, said, text), playerId, r.points, r.titleAwarded);
    });
    return sent;
  };

  /** El jugador elegido dijo la canción o el artista en voz alta: se le da sin escribir nada. */
  const awardSpoken = (part: "title" | "artist") =>
    run(async () => {
      if (!roundUrl || !selectedPlayer) return;
      const r = await api<GuessResult>(`${roundUrl}/award`, { json: { playerId: selectedPlayer.id, [part]: true } });
      await applyScore(spokenFeedback(selectedPlayer.name, part, r.points, text), selectedPlayer.id, r.points, r.titleAwarded);
    });

  /** La tele cierra el turno de quien pulsó: lo da por fallado o lo cancela sin dejarle fuera. */
  const resolveBuzz = (mode: "fail" | "cancel") =>
    run(async () => {
      if (!roundUrl) return;
      await api(`${roundUrl}/buzz`, { json: { mode } });
      await refresh();
    });

  /** Quien tiene el turno lo dijo en voz alta y era correcto: se le da la canción. */
  const awardBuzzer = () =>
    run(async () => {
      const buzz = round?.status === "PLAYING" ? round.buzz : null;
      if (!roundUrl || !buzz?.playerId) return;
      const r = await api<GuessResult>(`${roundUrl}/award`, { json: { playerId: buzz.playerId, title: true } });
      const owner = game?.players.find((p) => p.id === buzz.playerId)?.name ?? buzz.name;
      await applyScore(spokenFeedback(owner, "title", r.points, text), buzz.playerId, r.points, true);
    });

  /** El anfitrión da por bueno el título o el artista de un intento rechazado. */
  const acceptGuess = (guess: GuessRow, part: "title" | "artist") =>
    run(async () => {
      if (!roundUrl) return;
      const r = await api<{ points: number; titleAwarded: boolean }>(`${roundUrl}/guesses/${guess.id}/accept`, {
        json: { [part]: true },
      });
      await applyScore(acceptedFeedback(guess.playerName, r.points, text), guess.playerId, r.points, r.titleAwarded);
    });

  return {
    startNext,
    replay,
    togglePause,
    reveal,
    submitGuess,
    acceptGuess,
    resolveBuzz,
    awardBuzzer,
    awardTitle: () => awardSpoken("title"),
    awardArtist: () => awardSpoken("artist"),
  };
}
