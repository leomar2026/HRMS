CREATE TABLE "NumberSeries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "separator" TEXT NOT NULL DEFAULT '-',
    "padding" INTEGER NOT NULL DEFAULT 5,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "startNumber" INTEGER NOT NULL DEFAULT 1,
    "resetFrequency" TEXT NOT NULL DEFAULT 'NEVER',
    "lastResetKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "NumberSeries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NumberSeries_code_key" ON "NumberSeries"("code");
