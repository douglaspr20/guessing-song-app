"use client";

import { useEffect, useRef } from "react";

/** Un aviso del servidor: qué pasó en la partida (nunca lleva respuestas). */
export interface LiveEvent {
  type: string;
  [key: string]: unknown;
}

const POLL_MS = 3_000;
/** Aunque haya WebSocket, se relee de vez en cuando por si se perdió algún aviso. */
const SAFETY_POLL_MS = 15_000;

/**
 * Se suscribe a los avisos de una partida. Con Ably llegan por WebSocket al instante; sin él (o si
 * falla) se consulta cada pocos segundos. En ambos casos `onEvent` decide qué volver a leer.
 */
export function useLiveGame(gameId: string, onEvent: (event: LiveEvent) => void, enabled = true) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    if (!enabled) return;
    let closed = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let close: (() => void) | null = null;

    const startPolling = (every: number) => {
      if (poll) clearInterval(poll);
      poll = setInterval(() => !document.hidden && handler.current({ type: "poll" }), every);
    };

    const connect = async () => {
      try {
        const res = await fetch(`/api/realtime/token?game=${encodeURIComponent(gameId)}`, { cache: "no-store" });
        const first = res.ok ? ((await res.json()) as { enabled: boolean; tokenRequest?: unknown }) : null;
        if (closed) return;
        if (!first?.enabled) return startPolling(POLL_MS);

        const { Realtime } = await import("ably");
        if (closed) return;
        let pending = first.tokenRequest;
        const client = new Realtime({
          authCallback: async (_params, callback) => {
            try {
              if (pending) {
                const token = pending;
                pending = undefined;
                return callback(null, token as never);
              }
              const r = await fetch(`/api/realtime/token?game=${encodeURIComponent(gameId)}`, { cache: "no-store" });
              const body = (await r.json()) as { tokenRequest?: unknown };
              callback(null, body.tokenRequest as never);
            } catch (err) {
              callback(String((err as Error)?.message ?? err), null);
            }
          },
        });
        const channel = client.channels.get(`game:${gameId}`);
        void channel.subscribe((message) => handler.current({ type: message.name ?? "event", ...(message.data ?? {}) }));
        // Al volver a conectar (tras perder la red) se relee todo por si se perdió algo.
        client.connection.on("connected", () => handler.current({ type: "reconnected" }));
        client.connection.on("failed", () => startPolling(POLL_MS));
        startPolling(SAFETY_POLL_MS);
        close = () => client.close();
      } catch {
        if (!closed) startPolling(POLL_MS);
      }
    };

    void connect();
    return () => {
      closed = true;
      if (poll) clearInterval(poll);
      close?.();
    };
  }, [gameId, enabled]);
}
