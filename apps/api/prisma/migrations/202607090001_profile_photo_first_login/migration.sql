ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "firstLoginRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastPasswordResetBy" TEXT,
  ADD COLUMN IF NOT EXISTS "lastPasswordResetAt" TIMESTAMP(3);

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "profile_photo_path" TEXT,
  ADD COLUMN IF NOT EXISTS "profile_photo_file_name" TEXT,
  ADD COLUMN IF NOT EXISTS "profile_photo_mime_type" TEXT,
  ADD COLUMN IF NOT EXISTS "profile_photo_size" INTEGER,
  ADD COLUMN IF NOT EXISTS "profile_photo_uploaded_by" TEXT,
  ADD COLUMN IF NOT EXISTS "profile_photo_uploaded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "profile_photo_status" TEXT NOT NULL DEFAULT 'ACTIVE';
