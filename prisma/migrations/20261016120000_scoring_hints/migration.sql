-- AlterTable
ALTER TABLE "Game" ADD COLUMN "nextTrack" TEXT;
ALTER TABLE "Game" ADD COLUMN "nextTrackFilters" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Guess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "titleText" TEXT,
    "artistText" TEXT,
    "titleCorrect" BOOLEAN NOT NULL DEFAULT false,
    "artistCorrect" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 0,
    "overridden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Guess_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Guess_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Conserva los intentos existentes: text -> titleText, correct -> titleCorrect (valían 1 punto).
INSERT INTO "new_Guess" ("createdAt", "id", "playerId", "roundId", "titleText", "titleCorrect", "points") SELECT "createdAt", "id", "playerId", "roundId", "text", "correct", CASE WHEN "correct" THEN 1 ELSE 0 END FROM "Guess";
DROP TABLE "Guess";
ALTER TABLE "new_Guess" RENAME TO "Guess";
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Round_winnerPlayerId_fkey" FOREIGN KEY ("winnerPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Round_artistWinnerPlayerId_fkey" FOREIGN KEY ("artistWinnerPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Round" ("albumImage", "artists", "createdAt", "durationMs", "gameId", "id", "number", "startMs", "status", "trackId", "trackName", "trackUri", "winnerPlayerId") SELECT "albumImage", "artists", "createdAt", "durationMs", "gameId", "id", "number", "startMs", "status", "trackId", "trackName", "trackUri", "winnerPlayerId" FROM "Round";
DROP TABLE "Round";
ALTER TABLE "new_Round" RENAME TO "Round";
CREATE UNIQUE INDEX "Round_gameId_number_key" ON "Round"("gameId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

