-- ==============================================================================
-- CAL METER — PART 5: Food Database Foundation Migration
-- Additive migration for categories, data sources, batches, nutrient profiles,
-- food aliases, composite ingredients, and safety CHECK constraints.
-- ==============================================================================

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DRY_RUN');

-- CreateTable: food_categories
CREATE TABLE "food_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: food_data_sources
CREATE TABLE "food_data_sources" (
    "id" UUID NOT NULL,
    "source" "FoodSource" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "license" VARCHAR(150) NOT NULL,
    "license_url" VARCHAR(500),
    "attribution" VARCHAR(500),
    "description" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable: food_import_batches
CREATE TABLE "food_import_batches" (
    "id" UUID NOT NULL,
    "source" "FoodSource" NOT NULL,
    "batch_number" VARCHAR(100) NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "imported_records" INTEGER NOT NULL DEFAULT 0,
    "failed_records" INTEGER NOT NULL DEFAULT 0,
    "skipped_records" INTEGER NOT NULL DEFAULT 0,
    "error_log" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "food_import_batches_pkey" PRIMARY KEY ("id")
);

-- AlterTable: food_items (additive columns)
ALTER TABLE "food_items"
    ADD COLUMN "external_id" VARCHAR(100),
    ADD COLUMN "cuisine" VARCHAR(50),
    ADD COLUMN "state" VARCHAR(30),
    ADD COLUMN "prep_method" VARCHAR(50),
    ADD COLUMN "is_custom" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "confidence_score" DECIMAL(3,2),
    ADD COLUMN "category_id" UUID,
    ADD COLUMN "data_source_id" UUID,
    ADD COLUMN "import_batch_id" UUID;

-- CreateTable: food_nutrient_profiles
CREATE TABLE "food_nutrient_profiles" (
    "id" UUID NOT NULL,
    "food_item_id" UUID NOT NULL,
    "calories" DECIMAL(8,2) NOT NULL,
    "protein" DECIMAL(8,2) NOT NULL,
    "carbs" DECIMAL(8,2) NOT NULL,
    "fat" DECIMAL(8,2) NOT NULL,
    "saturated_fat" DECIMAL(8,2),
    "trans_fat" DECIMAL(8,2),
    "fiber" DECIMAL(8,2),
    "sugar" DECIMAL(8,2),
    "added_sugar" DECIMAL(8,2),
    "sodium" DECIMAL(8,2),
    "cholesterol" DECIMAL(8,2),
    "potassium" DECIMAL(8,2),
    "calcium" DECIMAL(8,2),
    "iron" DECIMAL(8,2),
    "vitamin_d" DECIMAL(8,2),
    "vitamin_b12" DECIMAL(8,2),
    "micronutrients" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_nutrient_profiles_pkey" PRIMARY KEY ("id")
);

-- AlterTable: serving_unit_conversions (additive columns)
ALTER TABLE "serving_unit_conversions"
    ADD COLUMN "serving_description" VARCHAR(100),
    ADD COLUMN "provenance" VARCHAR(50) NOT NULL DEFAULT 'USER_CONFIGURED';

-- CreateTable: food_aliases
CREATE TABLE "food_aliases" (
    "id" UUID NOT NULL,
    "food_item_id" UUID NOT NULL,
    "alias" VARCHAR(255) NOT NULL,
    "language" VARCHAR(20),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable: food_ingredients
CREATE TABLE "food_ingredients" (
    "id" UUID NOT NULL,
    "parent_food_item_id" UUID NOT NULL,
    "ingredient_food_item_id" UUID,
    "ingredient_name" VARCHAR(255) NOT NULL,
    "gram_weight" DECIMAL(8,2),
    "notes" VARCHAR(255),
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_ingredients_pkey" PRIMARY KEY ("id")
);

-- Unique constraints and indexes
CREATE UNIQUE INDEX "food_categories_name_key" ON "food_categories"("name");
CREATE UNIQUE INDEX "food_categories_slug_key" ON "food_categories"("slug");

CREATE UNIQUE INDEX "food_data_sources_source_key" ON "food_data_sources"("source");

CREATE UNIQUE INDEX "food_import_batches_batch_number_key" ON "food_import_batches"("batch_number");
CREATE INDEX "food_import_batches_source_status_idx" ON "food_import_batches"("source", "status");

CREATE INDEX "food_items_cuisine_idx" ON "food_items"("cuisine");
CREATE INDEX "food_items_category_id_idx" ON "food_items"("category_id");
CREATE INDEX "food_items_created_by_user_id_idx" ON "food_items"("created_by_user_id");
CREATE INDEX "food_items_external_id_idx" ON "food_items"("external_id");
CREATE INDEX "food_items_is_custom_is_archived_idx" ON "food_items"("is_custom", "is_archived");

CREATE UNIQUE INDEX "food_nutrient_profiles_food_item_id_key" ON "food_nutrient_profiles"("food_item_id");

CREATE INDEX "serving_unit_conversions_food_item_id_idx" ON "serving_unit_conversions"("food_item_id");

CREATE UNIQUE INDEX "food_aliases_food_item_id_alias_key" ON "food_aliases"("food_item_id", "alias");
CREATE INDEX "food_aliases_alias_idx" ON "food_aliases"("alias");

CREATE INDEX "food_ingredients_parent_food_item_id_idx" ON "food_ingredients"("parent_food_item_id");

-- Foreign key constraints
ALTER TABLE "food_import_batches"
    ADD CONSTRAINT "food_import_batches_source_fkey" FOREIGN KEY ("source") REFERENCES "food_data_sources"("source") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "food_items"
    ADD CONSTRAINT "food_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "food_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "food_items"
    ADD CONSTRAINT "food_items_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "food_data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "food_items"
    ADD CONSTRAINT "food_items_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "food_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "food_nutrient_profiles"
    ADD CONSTRAINT "food_nutrient_profiles_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "food_aliases"
    ADD CONSTRAINT "food_aliases_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "food_ingredients"
    ADD CONSTRAINT "food_ingredients_parent_food_item_id_fkey" FOREIGN KEY ("parent_food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "food_ingredients"
    ADD CONSTRAINT "food_ingredients_ingredient_food_item_id_fkey" FOREIGN KEY ("ingredient_food_item_id") REFERENCES "food_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK constraints for structural non-negativity and domain safety
ALTER TABLE "food_nutrient_profiles"
  ADD CONSTRAINT "food_nutrient_profiles_calories_check" CHECK ("calories" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_protein_check" CHECK ("protein" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_carbs_check" CHECK ("carbs" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_fat_check" CHECK ("fat" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_saturated_fat_check" CHECK ("saturated_fat" IS NULL OR "saturated_fat" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_trans_fat_check" CHECK ("trans_fat" IS NULL OR "trans_fat" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_fiber_check" CHECK ("fiber" IS NULL OR "fiber" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_sugar_check" CHECK ("sugar" IS NULL OR "sugar" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_added_sugar_check" CHECK ("added_sugar" IS NULL OR "added_sugar" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_sodium_check" CHECK ("sodium" IS NULL OR "sodium" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_cholesterol_check" CHECK ("cholesterol" IS NULL OR "cholesterol" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_potassium_check" CHECK ("potassium" IS NULL OR "potassium" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_calcium_check" CHECK ("calcium" IS NULL OR "calcium" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_iron_check" CHECK ("iron" IS NULL OR "iron" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_vitamin_d_check" CHECK ("vitamin_d" IS NULL OR "vitamin_d" >= 0),
  ADD CONSTRAINT "food_nutrient_profiles_vitamin_b12_check" CHECK ("vitamin_b12" IS NULL OR "vitamin_b12" >= 0);

ALTER TABLE "food_items"
  ADD CONSTRAINT "food_items_confidence_score_check" CHECK ("confidence_score" IS NULL OR ("confidence_score" >= 0 AND "confidence_score" <= 1));

ALTER TABLE "food_import_batches"
  ADD CONSTRAINT "food_import_batches_total_records_check" CHECK ("total_records" >= 0),
  ADD CONSTRAINT "food_import_batches_imported_records_check" CHECK ("imported_records" >= 0),
  ADD CONSTRAINT "food_import_batches_failed_records_check" CHECK ("failed_records" >= 0),
  ADD CONSTRAINT "food_import_batches_skipped_records_check" CHECK ("skipped_records" >= 0);

ALTER TABLE "food_ingredients"
  ADD CONSTRAINT "food_ingredients_gram_weight_check" CHECK ("gram_weight" IS NULL OR "gram_weight" > 0);
