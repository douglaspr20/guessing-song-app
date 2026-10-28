-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "nextGameId" TEXT;

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "gameId" TEXT,
    "mode" TEXT,
    "format" TEXT,
    "ownerKind" TEXT,
    "replay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameEvent_type_createdAt_idx" ON "GameEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "GameEvent_createdAt_idx" ON "GameEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_nextGameId_fkey" FOREIGN KEY ("nextGameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
