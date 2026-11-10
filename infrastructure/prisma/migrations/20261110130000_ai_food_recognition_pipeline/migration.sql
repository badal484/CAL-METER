-- ==============================================================================
-- CAL METER — PART 6: AI Food Recognition & Nutrition Estimation Migration
-- Additive migration for scan states, recognition persistence, portion metadata,
-- user corrections, deterministic nutrition results, and meal confirmation link.
-- ==============================================================================

-- AlterEnum: ScanStatus
ALTER TYPE "ScanStatus" ADD VALUE IF NOT EXISTS 'CREATED';
ALTER TYPE "ScanStatus" ADD VALUE IF NOT EXISTS 'UPLOADED';
ALTER TYPE "ScanStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "ScanStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW';
ALTER TYPE "ScanStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterTable: food_scan_logs
ALTER TABLE "food_scan_logs"
  ALTER COLUMN "raw_ai_response" SET DEFAULT '{}',
  ALTER COLUMN "detected_items" SET DEFAULT '[]',
  ALTER COLUMN "latency_ms" SET DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mime_type" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "file_size_bytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "image_width" INTEGER,
  ADD COLUMN IF NOT EXISTS "image_height" INTEGER,
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "model" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "prompt_tokens" INTEGER,
  ADD COLUMN IF NOT EXISTS "completion_tokens" INTEGER,
  ADD COLUMN IF NOT EXISTS "user_corrections" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "nutrition_result" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "error_message" VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "failure_reason" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "meal_entry_id" UUID,
  ADD COLUMN IF NOT EXISTS "meal_type" "MealType",
  ADD COLUMN IF NOT EXISTS "uploaded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "food_scan_logs_status_idx" ON "food_scan_logs"("status");
CREATE INDEX IF NOT EXISTS "food_scan_logs_meal_entry_id_idx" ON "food_scan_logs"("meal_entry_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'food_scan_logs_meal_entry_id_fkey'
  ) THEN
    ALTER TABLE "food_scan_logs"
      ADD CONSTRAINT "food_scan_logs_meal_entry_id_fkey"
      FOREIGN KEY ("meal_entry_id") REFERENCES "meal_entries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
