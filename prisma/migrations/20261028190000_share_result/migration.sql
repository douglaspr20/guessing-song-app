-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "shareLocale" TEXT,
ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Game_shareToken_key" ON "Game"("shareToken");

