import { afterAll, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";

// Fuera de una petición de Next, `after()` (precarga de la siguiente canción) no existe:
// en los tests no hace nada, así tampoco se llama a iTunes ni a Spotify.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => undefined,
}));

beforeEach(async () => {
  await db.$executeRawUnsafe(
    `TRUNCATE "Game", "Guest", "User", "Invite", "LoginAttempt", "BlockedIp", "AppState", "Session", "SpotifyAccount", "GoogleAccount" CASCADE`,
  );
});

afterAll(async () => {
  await db.$disconnect();
});
