import "server-only";
import { AppError } from "@/lib/errors";
import { spotifyFetch } from "./client";
import { PLAYER_NAME } from "./constants";

/** id actual del reproductor del navegador según Spotify (por su nombre), o null. */
async function findBrowserDevice(userId: string): Promise<string | null> {
  const { devices } = await spotifyFetch<{ devices: { id: string | null; name: string }[] }>(userId, "/me/player/devices");
  return devices.find((d) => d.name === PLAYER_NAME && d.id)?.id ?? null;
}

/** Hace de `deviceId` el dispositivo activo de la cuenta (sin empezar a sonar). */
async function transferPlayback(userId: string, deviceId: string) {
  await spotifyFetch<void>(userId, "/me/player", { method: "PUT", body: { device_ids: [deviceId], play: false } });
}

/**
 * Reproduce `uri` desde `positionMs` en el dispositivo indicado (el del Web Playback SDK).
 * Si Spotify aún no lo tiene registrado ("404 Device not found"), lo activa y reintenta una vez.
 */
export async function startPlayback(userId: string, deviceId: string, uri: string, positionMs: number): Promise<string> {
  const play = (id: string) =>
    spotifyFetch<void>(userId, "/me/player/play", {
      method: "PUT",
      query: { device_id: id },
      body: { uris: [uri], position_ms: positionMs },
    });
  try {
    await play(deviceId);
    return deviceId;
  } catch (err) {
    if (!(err instanceof AppError) || err.status !== 404) throw err;
  }
  // El id que mandó el navegador ya no existe para Spotify: buscamos el reproductor por su nombre.
  const current = (await findBrowserDevice(userId)) ?? deviceId;
  if (current !== deviceId) console.warn(`Reproductor desactualizado: ${deviceId} → ${current}`);
  await transferPlayback(userId, current);
  await new Promise((r) => setTimeout(r, 600));
  await play(current);
  return current;
}

export async function pausePlayback(userId: string, deviceId: string) {
  await spotifyFetch<void>(userId, "/me/player/pause", { method: "PUT", query: { device_id: deviceId } });
}
