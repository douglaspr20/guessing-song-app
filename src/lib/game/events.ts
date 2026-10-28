/**
 * Bus de eventos de dominio. Cada evento se reparte a los oyentes en memoria de esta instancia y,
 * además, se publica en Ably para que lleguen a los móviles y a la tele aunque la petición haya
 * caído en otra instancia de Vercel (ver `src/lib/realtime/ably.ts`).
 */
import { after } from "next/server";
import { publish } from "@/lib/realtime/ably";

export type GameEvent =
  | { type: "game_created"; gameId: string }
  | { type: "player_joined"; gameId: string; playerId: string; name: string }
  | { type: "round_started"; gameId: string; roundId: string; number: number }
  | { type: "guess_submitted"; gameId: string; roundId: string; playerId: string; correct: boolean }
  | { type: "artist_guessed"; gameId: string; roundId: string; playerId: string }
  | { type: "round_won"; gameId: string; roundId: string; playerId: string }
  | { type: "round_revealed"; gameId: string; roundId: string }
  | { type: "round_playing"; gameId: string; roundId: string }
  | { type: "round_paused"; gameId: string; roundId: string }
  | { type: "round_resumed"; gameId: string; roundId: string }
  | { type: "game_finished"; gameId: string }
  /** El anfitrión grabó «Otra igual»: los móviles unidos a esta partida pasan a la nueva. */
  | { type: "next_game"; gameId: string; nextGameId: string }
  | { type: "participant_joined"; gameId: string; participantId: string; name: string }
  | { type: "participant_left"; gameId: string; participantId: string }
  | { type: "join_toggled"; gameId: string; open: boolean }
  | { type: "buzz"; gameId: string; roundId: string; participantId: string; name: string }
  | {
      type: "buzz_resolved";
      gameId: string;
      roundId: string;
      participantId: string;
      name: string;
      correct: boolean;
      /** Cómo acabó el turno: acertó, falló, se le acabó el tiempo o el anfitrión lo canceló. */
      outcome: "correct" | "wrong" | "timeout" | "cancelled";
    };

type Listener = (event: GameEvent) => void;

const globalForEvents = globalThis as unknown as { gameListeners?: Map<string, Set<Listener>> };
const listeners = (globalForEvents.gameListeners ??= new Map());

export function subscribe(gameId: string, listener: Listener): () => void {
  const set = listeners.get(gameId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(gameId, set);
  return () => {
    set.delete(listener);
    if (!set.size) listeners.delete(gameId);
  };
}

export function emit(event: GameEvent) {
  publishLive(event);
  for (const listener of listeners.get(event.gameId) ?? []) {
    try {
      listener(event);
    } catch (err) {
      console.error("Error en listener de eventos", err);
    }
  }
}

/** Aviso a los dispositivos conectados, sin frenar la respuesta de la petición. */
function publishLive(event: GameEvent) {
  const { type, gameId, ...rest } = event;
  const send = () => publish(gameId, type, rest);
  try {
    after(send);
  } catch {
    // Fuera de una petición (cron, scripts) `after` no existe: se envía sin esperar.
    void send();
  }
}
