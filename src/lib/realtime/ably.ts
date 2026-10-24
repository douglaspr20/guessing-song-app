import "server-only";
import { Rest } from "ably";

/**
 * Tiempo real con Ably: el servidor publica un aviso por cada cosa que pasa en una partida y los
 * móviles y la tele, suscritos por WebSocket, vuelven a leer el estado de Postgres. Los avisos no
 * llevan datos sensibles (ni respuestas): solo qué ocurrió. Sin `ABLY_API_KEY` no hace nada y los
 * clientes consultan cada pocos segundos.
 */

export const realtimeEnabled = () => !!process.env.ABLY_API_KEY;

/** Canal de una partida. */
export const gameChannel = (gameId: string) => `game:${gameId}`;

const globalForAbly = globalThis as unknown as { ablyRest?: Rest };

function client() {
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;
  return (globalForAbly.ablyRest ??= new Rest({ key }));
}

/** Publica un aviso en el canal de la partida. Nunca lanza: el juego no depende del tiempo real. */
export async function publish(gameId: string, name: string, data: Record<string, unknown>) {
  const rest = client();
  if (!rest) return;
  try {
    await rest.channels.get(gameChannel(gameId)).publish(name, data);
  } catch (err) {
    console.error("No se pudo publicar en Ably", err);
  }
}

/** Petición de token con permiso solo para escuchar el canal de esta partida (1 h). */
export async function createGameToken(gameId: string, clientId: string) {
  const rest = client();
  if (!rest) return null;
  return rest.auth.createTokenRequest({
    clientId,
    ttl: 60 * 60_000,
    capability: JSON.stringify({ [gameChannel(gameId)]: ["subscribe"] }),
  });
}
