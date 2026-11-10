-- CreateEnum
CREATE TYPE "BiologicalSex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'SUPERSEDED');

-- AlterTable user_profiles
ALTER TABLE "user_profiles"
  ADD COLUMN "biological_sex" "BiologicalSex";

-- AlterTable nutrition_goals
ALTER TABLE "nutrition_goals"
  ADD COLUMN "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "primary_goal" "PrimaryGoal",
  ADD COLUMN "target_weight_kg" DECIMAL(5, 2),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "nutrition_goals_user_id_status_idx" ON "nutrition_goals"("user_id", "status");
