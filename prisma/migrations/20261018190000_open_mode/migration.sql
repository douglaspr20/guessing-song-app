-- AlterTable
ALTER TABLE "Round" ADD COLUMN "audioUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'spotify',
    "status" TEXT NOT NULL DEFAULT 'LOBBY',
    "totalRounds" INTEGER NOT NULL,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "fragmentSeconds" INTEGER NOT NULL,
    "filters" TEXT NOT NULL,
    "nextTrack" TEXT,
    "nextTrackFilters" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Game" ("code", "createdAt", "currentRound", "filters", "fragmentSeconds", "id", "nextTrack", "nextTrackFilters", "status", "totalRounds") SELECT "code", "createdAt", "currentRound", "filters", "fragmentSeconds", "id", "nextTrack", "nextTrackFilters", "status", "totalRounds" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE UNIQUE INDEX "Game_code_key" ON "Game"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

