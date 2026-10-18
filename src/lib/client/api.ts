// Cliente de la API para las pantallas. Solo tipos del servidor (se borran al compilar).
import type { PublicGame, PublicRound, listGames, getRoundGuesses } from "@/lib/game/service";

export type Game = PublicGame;
export type Round = PublicRound;
export type GameList = Awaited<ReturnType<typeof listGames>>;
export type GameSummary = GameList["games"][number];
export type GuessRow = Awaited<ReturnType<typeof getRoundGuesses>>[number];
export type Player = Game["players"][number];

export interface AuthStatus {
  connected: boolean;
  profile?: { displayName: string | null; premium: boolean | null; country: string | null };
}

export interface Catalog {
  genres: string[];
  languages: { id: string; label: string; market: string }[];
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
  if (!res.ok) throw new ApiError(data.message ?? "Algo salió mal", data.error ?? "UNKNOWN", res.status);
  return data as T;
}

export const catalogLabel = (n: number) => `C-${String(n).padStart(3, "0")}`;

export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
export const formatDate = (iso: string | Date) => dateFmt.format(new Date(iso));
