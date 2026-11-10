-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'NUTRITIONIST');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE', 'EXTRA_ACTIVE');

-- CreateEnum
CREATE TYPE "PrimaryGoal" AS ENUM ('LOSE_WEIGHT', 'MAINTAIN_WEIGHT', 'BUILD_MUSCLE');

-- CreateEnum
CREATE TYPE "DietPreference" AS ENUM ('ANY', 'VEGETARIAN', 'VEGAN', 'EGGETARIAN', 'JAIN', 'KETO', 'HALAL');

-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('METRIC', 'IMPERIAL');

-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('USDA_FOOD_DATA_CENTRAL', 'OPEN_FOOD_FACTS', 'INDIAN_FCT_NIN', 'CUSTOM_USER', 'VERIFIED_COMMUNITY');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "LoggedMethod" AS ENUM ('AI_PHOTO', 'GALLERY_PHOTO', 'BARCODE', 'SEARCH', 'MANUAL_ENTRY', 'VOICE');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'PREFER_NOT_TO_SAY',
    "dob" DATE,
    "height_cm" DECIMAL(5,2) NOT NULL,
    "current_weight_kg" DECIMAL(5,2) NOT NULL,
    "target_weight_kg" DECIMAL(5,2) NOT NULL,
    "activity_level" "ActivityLevel" NOT NULL DEFAULT 'MODERATELY_ACTIVE',
    "diet_preference" "DietPreference" NOT NULL DEFAULT 'ANY',
    "primary_goal" "PrimaryGoal" NOT NULL DEFAULT 'LOSE_WEIGHT',
    "pace_kg_per_week" DECIMAL(3,2) NOT NULL DEFAULT 0.50,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "preferred_units" "UnitSystem" NOT NULL DEFAULT 'METRIC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "daily_calories" INTEGER NOT NULL,
    "protein_grams" DECIMAL(6,2) NOT NULL,
    "carbs_grams" DECIMAL(6,2) NOT NULL,
    "fat_grams" DECIMAL(6,2) NOT NULL,
    "fiber_grams" DECIMAL(6,2) NOT NULL DEFAULT 30.00,
    "water_ml" INTEGER NOT NULL DEFAULT 2500,
    "effective_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nutrition_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_items" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "local_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brand" VARCHAR(255),
    "barcode" VARCHAR(64),
    "source" "FoodSource" NOT NULL DEFAULT 'CUSTOM_USER',
    "serving_size" DECIMAL(8,2) NOT NULL DEFAULT 100.00,
    "serving_unit" VARCHAR(50) NOT NULL DEFAULT 'g',
    "standard_weight_grams" DECIMAL(8,2) NOT NULL DEFAULT 100.00,
    "calories" DECIMAL(8,2) NOT NULL,
    "protein" DECIMAL(8,2) NOT NULL,
    "carbs" DECIMAL(8,2) NOT NULL,
    "fat" DECIMAL(8,2) NOT NULL,
    "fiber" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "micronutrients" JSONB NOT NULL DEFAULT '{}',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serving_unit_conversions" (
    "id" UUID NOT NULL,
    "food_item_id" UUID NOT NULL,
    "unit_name" VARCHAR(50) NOT NULL,
    "gram_weight" DECIMAL(8,2) NOT NULL,
    "ml_volume" DECIMAL(8,2),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serving_unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR(500),
    "total_calories" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "total_protein" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "total_carbs" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "total_fat" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_food_items" (
    "id" UUID NOT NULL,
    "meal_entry_id" UUID NOT NULL,
    "food_item_id" UUID,
    "food_name" VARCHAR(255) NOT NULL,
    "portion_amount" DECIMAL(6,2) NOT NULL DEFAULT 1.00,
    "serving_unit" VARCHAR(50) NOT NULL,
    "gram_weight" DECIMAL(8,2) NOT NULL,
    "calories" DECIMAL(8,2) NOT NULL,
    "protein" DECIMAL(8,2) NOT NULL,
    "carbs" DECIMAL(8,2) NOT NULL,
    "fat" DECIMAL(8,2) NOT NULL,
    "confidence_score" DECIMAL(3,2),
    "logged_method" "LoggedMethod" NOT NULL DEFAULT 'SEARCH',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_food_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_scan_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "raw_ai_response" JSONB NOT NULL,
    "detected_items" JSONB NOT NULL,
    "matched_food_ids" JSONB NOT NULL DEFAULT '[]',
    "user_edited" BOOLEAN NOT NULL DEFAULT false,
    "latency_ms" INTEGER NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_scan_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "weight_kg" DECIMAL(5,2) NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR(255),

    CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount_ml" INTEGER NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rc_app_user_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
    "plan_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "is_processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "nutrition_goals_user_id_effective_date_idx" ON "nutrition_goals"("user_id", "effective_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "food_items_barcode_key" ON "food_items"("barcode");

-- CreateIndex
CREATE INDEX "food_items_name_idx" ON "food_items"("name");

-- CreateIndex
CREATE INDEX "food_items_barcode_idx" ON "food_items"("barcode");

-- CreateIndex
CREATE INDEX "food_items_source_is_verified_idx" ON "food_items"("source", "is_verified");

-- CreateIndex
CREATE UNIQUE INDEX "serving_unit_conversions_food_item_id_unit_name_key" ON "serving_unit_conversions"("food_item_id", "unit_name");

-- CreateIndex
CREATE INDEX "meal_entries_user_id_date_idx" ON "meal_entries"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "meal_entries_user_id_date_meal_type_key" ON "meal_entries"("user_id", "date", "meal_type");

-- CreateIndex
CREATE INDEX "meal_food_items_meal_entry_id_idx" ON "meal_food_items"("meal_entry_id");

-- CreateIndex
CREATE INDEX "food_scan_logs_user_id_created_at_idx" ON "food_scan_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "weight_logs_user_id_logged_at_idx" ON "weight_logs"("user_id", "logged_at" DESC);

-- CreateIndex
CREATE INDEX "water_logs_user_id_date_idx" ON "water_logs"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_rc_app_user_id_key" ON "subscriptions"("rc_app_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "deletion_requests_user_id_key" ON "deletion_requests"("user_id");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_goals" ADD CONSTRAINT "nutrition_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_items" ADD CONSTRAINT "food_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serving_unit_conversions" ADD CONSTRAINT "serving_unit_conversions_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_food_items" ADD CONSTRAINT "meal_food_items_meal_entry_id_fkey" FOREIGN KEY ("meal_entry_id") REFERENCES "meal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_food_items" ADD CONSTRAINT "meal_food_items_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_scan_logs" ADD CONSTRAINT "food_scan_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
