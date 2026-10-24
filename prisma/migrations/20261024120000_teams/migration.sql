-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'solo',
ADD COLUMN     "maxTeamSize" INTEGER;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "color" TEXT;

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamMember_playerId_idx" ON "TeamMember"("playerId");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

