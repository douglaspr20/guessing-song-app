"use client";

/**
 * Un único reproductor de Spotify (Web Playback SDK) para toda la app.
 *
 * Next conserva las páginas al navegar (React <Activity>): si cada pantalla creara su propio
 * reproductor, al ir y volver quedaría un `device_id` que Spotify ya dio por desconectado
 * ("404 Device not found"). Aquí se crea una vez y se reutiliza; si Spotify deja de reconocer
 * el dispositivo, `reconnect()` lo vuelve a registrar.
 */

import { PLAYER_NAME } from "@/lib/spotify/constants";

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
const READY_TIMEOUT_MS = 10_000;

export type PlayerStatus = "loading" | "ready" | "not_ready" | "error";

export interface DeviceState {
  status: PlayerStatus;
  deviceId: string | null;
  error: string | null;
}

let state: DeviceState = { status: "loading", deviceId: null, error: null };
let player: Spotify.Player | null = null;
let starting: Promise<void> | null = null;
const listeners = new Set<() => void>();
// Quienes esperan al siguiente "ready" (tras reconectar).
let readyWaiters: ((deviceId: string) => void)[] = [];

const SERVER_STATE: DeviceState = { status: "loading", deviceId: null, error: null };

function set(patch: Partial<DeviceState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getState = () => state;
export const getServerState = () => SERVER_STATE;
export const getPlayer = () => player;

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => reject(new Error("No se pudo cargar el reproductor de Spotify"));
    document.body.appendChild(script);
  });
}

async function fetchToken(): Promise<string> {
  const res = await fetch("/api/spotify/token", { cache: "no-store" });
  if (!res.ok) throw new Error("No hay sesión de Spotify. Vuelve a conectar tu cuenta.");
  const { accessToken } = await res.json();
  return accessToken;
}

function fail(message: string) {
  set({ status: "error", error: message, deviceId: null });
}

/** Crea el reproductor la primera vez; las siguientes llamadas no hacen nada. */
export function ensurePlayer(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  starting ??= loadSdk()
    .then(() => {
      const p = new window.Spotify.Player({
        name: PLAYER_NAME,
        volume: 0.85,
        getOAuthToken: (cb) => {
          fetchToken().then(cb, (e) => set({ error: e.message }));
        },
      });
      p.addListener("ready", ({ device_id }) => {
        set({ status: "ready", deviceId: device_id, error: null });
        readyWaiters.forEach((w) => w(device_id));
        readyWaiters = [];
      });
      p.addListener("not_ready", () => set({ status: "not_ready" }));
      p.addListener("initialization_error", () =>
        fail("Este navegador no puede reproducir Spotify. Abre el juego en Chrome o Edge."),
      );
      p.addListener("authentication_error", () => fail("Spotify rechazó la sesión. Vuelve a conectar tu cuenta."));
      p.addListener("account_error", () => fail("Hace falta una cuenta Spotify Premium para que suene."));
      p.addListener("playback_error", () => set({ error: "Spotify no pudo reproducir esta canción." }));
      player = p;
      return p.connect().then(() => undefined);
    })
    .catch((e: Error) => fail(e.message));
  return starting;
}

/** Vuelve a registrar el dispositivo en Spotify y devuelve el nuevo `device_id`. */
export async function reconnect(): Promise<string> {
  await ensurePlayer();
  if (!player) throw new Error("El reproductor de Spotify no está disponible");
  set({ status: "loading" });
  const next = new Promise<string>((resolve, reject) => {
    readyWaiters.push(resolve);
    setTimeout(() => reject(new Error("Spotify tardó demasiado en reconectar el reproductor")), READY_TIMEOUT_MS);
  });
  player.disconnect();
  await player.connect();
  return next;
}
