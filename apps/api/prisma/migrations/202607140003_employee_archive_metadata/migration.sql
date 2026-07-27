-- Add employee archive/delete metadata for safe employee lifecycle management.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "archivedBy" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

UPDATE "Employee"
SET "is_active" = false
WHERE "archivedAt" IS NOT NULL OR "status" = 'ARCHIVED';
