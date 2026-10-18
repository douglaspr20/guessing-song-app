-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "trackId" TEXT NOT NULL,
    "trackUri" TEXT NOT NULL,
    "trackName" TEXT NOT NULL,
    "artists" TEXT NOT NULL,
    "artistIds" TEXT NOT NULL DEFAULT '[]',
    "genre" TEXT,
    "albumImage" TEXT,
    "durationMs" INTEGER NOT NULL,
    "startMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLAYING',
    "winnerPlayerId" TEXT,
    "artistWinnerPlayerId" TEXT,
    "playStartedAt" DATETIME,
    "pausedAt" DATETIME,
    "pausedMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Round_winnerPlayerId_fkey" FOREIGN KEY ("winnerPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Round_artistWinnerPlayerId_fkey" FOREIGN KEY ("artistWinnerPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Round" ("albumImage", "artistIds", "artistWinnerPlayerId", "artists", "createdAt", "durationMs", "gameId", "genre", "id", "number", "playStartedAt", "startMs", "status", "trackId", "trackName", "trackUri", "winnerPlayerId") SELECT "albumImage", "artistIds", "artistWinnerPlayerId", "artists", "createdAt", "durationMs", "gameId", "genre", "id", "number", "playStartedAt", "startMs", "status", "trackId", "trackName", "trackUri", "winnerPlayerId" FROM "Round";
DROP TABLE "Round";
ALTER TABLE "new_Round" RENAME TO "Round";
CREATE UNIQUE INDEX "Round_gameId_number_key" ON "Round"("gameId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

