-- CreateTable
CREATE TABLE "FilterTest" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilterTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FilterTest_ownerKey_createdAt_idx" ON "FilterTest"("ownerKey", "createdAt");

-- CreateIndex
CREATE INDEX "FilterTest_createdAt_idx" ON "FilterTest"("createdAt");
