/**
 * Bus de eventos de dominio en memoria.
 * Hoy nadie escucha; cuando los jugadores se unan desde el móvil, un endpoint SSE/WebSocket
 * (o InsForge Realtime) se suscribirá aquí y reenviará los eventos de su partida.
 */
export type GameEvent =
  | { type: "game_created"; gameId: string }
  | { type: "player_joined"; gameId: string; playerId: string; name: string }
  | { type: "round_started"; gameId: string; roundId: string; number: number }
  | { type: "guess_submitted"; gameId: string; roundId: string; playerId: string; correct: boolean }
  | { type: "artist_guessed"; gameId: string; roundId: string; playerId: string }
  | { type: "round_won"; gameId: string; roundId: string; playerId: string }
  | { type: "round_revealed"; gameId: string; roundId: string }
  | { type: "game_finished"; gameId: string };

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
  for (const listener of listeners.get(event.gameId) ?? []) {
    try {
      listener(event);
    } catch (err) {
      console.error("Error en listener de eventos", err);
    }
  }
}
