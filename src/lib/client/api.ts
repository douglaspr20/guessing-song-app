// Cliente de la API para las pantallas. Solo tipos del servidor (se borran al compilar).
import type { PublicGame, PublicRound, listGames, getRoundGuesses } from "@/lib/game/service";
import { currentMessages } from "@/i18n/runtime";

export type Game = PublicGame;
export type Round = PublicRound;
export type GameList = Awaited<ReturnType<typeof listGames>>;
export type GameSummary = GameList["games"][number];
export type GuessRow = Awaited<ReturnType<typeof getRoundGuesses>>[number];
export type Player = Game["players"][number];

/** El sitio del anfitrión cuando también juega desde su pantalla (`GET /api/games/:id`). */
export interface HostSeat {
  id: string;
  name: string;
  playerId: string;
  memberId: string | null;
  /** Ya falló en la ronda en curso (él o su equipo). */
  lockedOut: boolean;
}

/** La partida tal como la ve su anfitrión. */
export type HostGame = Game & { hostSeat: HostSeat | null };

/** Quién usa la app (`/api/access/status`). */
export interface AccessStatus {
  user: {
    username: string;
    displayName: string;
    role: "host" | "member";
    /** Puede usar el modo Spotify (invitación o anfitrión). */
    spotifyAllowed: boolean;
    /** Tiene contraseña (si no, solo entra con Google y no puede desvincularlo). */
    hasPassword: boolean;
    /** El anfitrión le restableció la contraseña: tiene que ponerse una suya. */
    mustChangePassword: boolean;
    google: { email: string } | null;
  } | null;
  /** Este navegador ya eligió «Jugar sin cuenta». */
  guest: boolean;
  spotify: { linked: true; displayName: string | null; premium: boolean | null } | null;
  openModePaused: boolean;
  /** Hay credenciales de Google: se muestra «Continuar con Google». */
  googleEnabled: boolean;
}

export interface Catalog {
  genres: string[];
  languages: { id: string; market: string }[];
  decades: number[];
}

export interface Playlist {
  id: string;
  name: string;
  owner: string;
  totalTracks: number | null;
  image: string | null;
  needsReconnect?: boolean;
  /** false si es de otra persona: Spotify puede negarse a leerla. */
  readable: boolean;
}

export interface GuessResult {
  titleCorrect: boolean;
  artistCorrect: boolean;
  titleAwarded: boolean;
  artistAwarded: boolean;
  points: number;
  round: Round;
  players: Player[];
  gameStatus: Game["status"];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
    headers: init.json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Un fallo del servidor no le dice nada útil a la familia: mensaje común y que pueda reintentar.
    const { common } = currentMessages();
    // El servidor ya responde en el idioma de la persona (cookie o Accept-Language).
    const message = res.status >= 500 ? common.serverDown : (data.message ?? common.somethingWrong);
    throw new ApiError(message, data.error ?? "UNKNOWN", res.status);
  }
  return data as T;
}

export const catalogLabel = (n: number) => `C-${String(n).padStart(3, "0")}`;

export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Texto de un error para mostrarlo: el de la API, o «No se pudo conectar» si ni siquiera respondió. */
export function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : currentMessages().common.cantConnect;
}
