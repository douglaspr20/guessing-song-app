import { Pool } from "pg";
import { E2E_DATABASE_URL } from "./env";

/** Consultas directas a la base de pruebas (sin el cliente de Prisma, que es solo ESM). */
export const pool = new Pool({ connectionString: E2E_DATABASE_URL, max: 2 });

/** Deja la base como recién migrada (las mismas tablas que vacían los tests de integración). */
export async function resetDb() {
  await pool.query(
    `TRUNCATE "Game", "Guest", "User", "Invite", "LoginAttempt", "BlockedIp", "AppState", "Session", "SpotifyAccount", "GoogleAccount", "ItunesSearch", "FilterTest", "GameEvent" CASCADE`,
  );
}

/** La ronda en juego más reciente: su título y artista son lo que hay que escribir para acertarla. */
export async function playingRound(): Promise<{ id: string; gameId: string; trackName: string; artists: string }> {
  const { rows } = await pool.query(
    `SELECT id, "gameId", "trackName", artists FROM "Round" WHERE status = 'PLAYING' ORDER BY "createdAt" DESC LIMIT 1`,
  );
  if (!rows[0]) throw new Error("No hay ninguna ronda en juego");
  return rows[0];
}

/** El código de unión de la partida más reciente. */
export async function lastGameCode(): Promise<string> {
  const { rows } = await pool.query(`SELECT code FROM "Game" ORDER BY "createdAt" DESC LIMIT 1`);
  if (!rows[0]) throw new Error("No hay ninguna partida");
  return rows[0].code;
}
