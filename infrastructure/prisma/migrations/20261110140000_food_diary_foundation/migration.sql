-- AlterTable meal_entries
ALTER TABLE "meal_entries"
  ADD COLUMN "total_fiber" DECIMAL(8, 2) DEFAULT 0.00,
  ADD COLUMN "total_sugar" DECIMAL(8, 2) DEFAULT 0.00,
  ADD COLUMN "total_sodium" DECIMAL(8, 2) DEFAULT 0.00;

-- AlterTable meal_food_items
ALTER TABLE "meal_food_items"
  ADD COLUMN "fiber" DECIMAL(8, 2),
  ADD COLUMN "sugar" DECIMAL(8, 2),
  ADD COLUMN "sodium" DECIMAL(8, 2),
  ADD COLUMN "micronutrients" JSONB DEFAULT '{}',
  ADD COLUMN "scan_id" UUID,
  ADD COLUMN "notes" VARCHAR(255);

-- CreateIndex
CREATE INDEX "meal_food_items_food_item_id_idx" ON "meal_food_items"("food_item_id");
CREATE INDEX "meal_food_items_scan_id_idx" ON "meal_food_items"("scan_id");

-- AddForeignKey
ALTER TABLE "meal_food_items"
  ADD CONSTRAINT "meal_food_items_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "food_scan_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain CHECK constraints
ALTER TABLE "meal_food_items"
  ADD CONSTRAINT "chk_meal_food_items_portion_positive" CHECK ("portion_amount" > 0),
  ADD CONSTRAINT "chk_meal_food_items_gram_weight_positive" CHECK ("gram_weight" > 0),
  ADD CONSTRAINT "chk_meal_food_items_calories_non_neg" CHECK ("calories" >= 0),
  ADD CONSTRAINT "chk_meal_food_items_protein_non_neg" CHECK ("protein" >= 0),
  ADD CONSTRAINT "chk_meal_food_items_carbs_non_neg" CHECK ("carbs" >= 0),
  ADD CONSTRAINT "chk_meal_food_items_fat_non_neg" CHECK ("fat" >= 0),
  ADD CONSTRAINT "chk_meal_food_items_fiber_non_neg" CHECK ("fiber" IS NULL OR "fiber" >= 0),
  ADD CONSTRAINT "chk_meal_food_items_sugar_non_neg" CHECK ("sugar" IS NULL OR "sugar" >= 0),
  ADD CONSTRAINT "chk_meal_food_items_sodium_non_neg" CHECK ("sodium" IS NULL OR "sodium" >= 0);

ALTER TABLE "meal_entries"
  ADD CONSTRAINT "chk_meal_entries_calories_non_neg" CHECK ("total_calories" >= 0),
  ADD CONSTRAINT "chk_meal_entries_protein_non_neg" CHECK ("total_protein" >= 0),
  ADD CONSTRAINT "chk_meal_entries_carbs_non_neg" CHECK ("total_carbs" >= 0),
  ADD CONSTRAINT "chk_meal_entries_fat_non_neg" CHECK ("total_fat" >= 0),
  ADD CONSTRAINT "chk_meal_entries_fiber_non_neg" CHECK ("total_fiber" IS NULL OR "total_fiber" >= 0),
  ADD CONSTRAINT "chk_meal_entries_sugar_non_neg" CHECK ("total_sugar" IS NULL OR "total_sugar" >= 0),
  ADD CONSTRAINT "chk_meal_entries_sodium_non_neg" CHECK ("total_sodium" IS NULL OR "total_sodium" >= 0);
