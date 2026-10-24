-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "answerSeconds" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "joinOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lockout" TEXT NOT NULL DEFAULT 'person';

-- AlterTable
ALTER TABLE "Guess" ADD COLUMN     "participantId" TEXT;

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "buzzDeadline" TIMESTAMP(3),
ADD COLUMN     "buzzParticipantId" TEXT,
ADD COLUMN     "buzzedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "memberId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundLockout" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT,
    "playerId" TEXT,

    CONSTRAINT "RoundLockout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_tokenHash_key" ON "Participant"("tokenHash");

-- CreateIndex
CREATE INDEX "Participant_gameId_idx" ON "Participant"("gameId");

-- CreateIndex
CREATE INDEX "Participant_gameId_userId_idx" ON "Participant"("gameId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundLockout_roundId_participantId_key" ON "RoundLockout"("roundId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundLockout_roundId_playerId_key" ON "RoundLockout"("roundId", "playerId");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundLockout" ADD CONSTRAINT "RoundLockout_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

