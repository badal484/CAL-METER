-- ==============================================================================
-- CAL METER — PART 10: Progress, Water & Exercise Tracking Migration
-- Adds ExerciseLog model, tracking enums, and audit timestamps.
-- ==============================================================================

-- CreateEnum
CREATE TYPE "ExerciseCategory" AS ENUM (
  'WALKING',
  'RUNNING',
  'CYCLING',
  'SWIMMING',
  'GYM_WORKOUT',
  'STRENGTH_TRAINING',
  'YOGA',
  'SPORTS',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "ExerciseIntensity" AS ENUM (
  'LIGHT',
  'MODERATE',
  'VIGOROUS'
);

-- CreateEnum
CREATE TYPE "CalorieEstimateSource" AS ENUM (
  'MET_FORMULA',
  'MANUAL_ENTRY',
  'DEVICE'
);

-- AlterTable: WeightLog
ALTER TABLE "weight_logs"
  ADD COLUMN "source" VARCHAR(50) DEFAULT 'MANUAL',
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: WaterLog
ALTER TABLE "water_logs"
  ADD COLUMN "source" VARCHAR(50) DEFAULT 'MANUAL',
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "water_logs_user_id_logged_at_idx" ON "water_logs"("user_id", "logged_at" DESC);

-- CreateTable: ExerciseLog
CREATE TABLE "exercise_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" "ExerciseCategory" NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "distance_km" DECIMAL(6,2),
    "intensity" "ExerciseIntensity" NOT NULL DEFAULT 'MODERATE',
    "calories_burned" DECIMAL(6,1),
    "calorie_source" "CalorieEstimateSource",
    "met_value" DECIMAL(4,2),
    "notes" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "exercise_logs_duration_minutes_check" CHECK ("duration_minutes" > 0 AND "duration_minutes" <= 1440),
    CONSTRAINT "exercise_logs_distance_km_check" CHECK ("distance_km" IS NULL OR "distance_km" >= 0),
    CONSTRAINT "exercise_logs_calories_burned_check" CHECK ("calories_burned" IS NULL OR "calories_burned" >= 0)
);

-- CreateIndex
CREATE INDEX "exercise_logs_user_id_date_idx" ON "exercise_logs"("user_id", "date" DESC);
CREATE INDEX "exercise_logs_user_id_performed_at_idx" ON "exercise_logs"("user_id", "performed_at" DESC);

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

