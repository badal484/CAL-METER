-- CreateEnum
CREATE TYPE "CoachRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('CALORIE_PROGRESS', 'PROTEIN_PACING', 'MACRO_DISTRIBUTION', 'FIBER_INTAKE', 'HYDRATION_CONSISTENCY', 'EXERCISE_HABIT', 'WEIGHT_TRAJECTORY', 'MEAL_REGULARITY');

-- CreateEnum
CREATE TYPE "InsightCategory" AS ENUM ('CELEBRATION', 'RECOMMENDATION', 'OBSERVATION', 'CAUTION');

-- CreateTable
CREATE TABLE "coach_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role" "CoachRole" NOT NULL DEFAULT 'USER',
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_insights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "InsightType" NOT NULL,
    "category" "InsightCategory" NOT NULL DEFAULT 'OBSERVATION',
    "title" VARCHAR(150) NOT NULL,
    "message" TEXT NOT NULL,
    "actionable_tip" VARCHAR(300),
    "period_analyzed" VARCHAR(50) NOT NULL,
    "metric_data" JSONB,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "coach_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_messages_user_id_created_at_idx" ON "coach_messages"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "coach_insights_user_id_generated_at_idx" ON "coach_insights"("user_id", "generated_at" DESC);

-- CreateIndex
CREATE INDEX "coach_insights_user_id_type_idx" ON "coach_insights"("user_id", "type");

-- AddForeignKey
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_insights" ADD CONSTRAINT "coach_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
