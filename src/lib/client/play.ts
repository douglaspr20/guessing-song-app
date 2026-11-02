/** Lo que devuelve `POST /api/games/:id/rounds/:rid/play`. */
export interface PlayResponse {
  fragmentMs: number;
  /** Lo que queda de fragmento desde el punto en que se reanudó. */
  remainingMs: number;
  /** Solo en modo abierto: la vista previa que reproduce el navegador. */
  audioUrl: string | null;
}

/** Pide al servidor que haga sonar el fragmento (y arranque o reanude el reloj de la ronda). */
export async function requestPlay(gameId: string, roundId: string, body: { deviceId?: string; offsetMs: number }) {
  const res = await fetch(`/api/games/${gameId}/rounds/${roundId}/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data: data as PlayResponse & { error?: string; message?: string } };
}

/** Volumen (sobre el normal) mientras alguien responde con la canción sonando: se nota que pasa algo y se oye al que contesta. */
export const DUCKED_VOLUME = 0.35;
/** Cuánto tarda en bajar o subir el volumen, para que no sea un golpe. */
export const DUCK_RAMP_MS = 300;
