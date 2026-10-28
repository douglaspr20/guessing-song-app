-- CreateTable
CREATE TABLE "ItunesSearch" (
    "term" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "tracks" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItunesSearch_pkey" PRIMARY KEY ("term","country")
);

-- CreateIndex
CREATE INDEX "ItunesSearch_fetchedAt_idx" ON "ItunesSearch"("fetchedAt");
