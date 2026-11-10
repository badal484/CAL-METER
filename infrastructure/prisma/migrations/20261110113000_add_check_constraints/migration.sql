-- ==============================================================================
-- CAL METER — PART 4.1: Database Check Constraints Migration
-- Enforces structural non-negativity and positive value domains at database layer.
-- ==============================================================================

-- AlterTable: Add CHECK constraints to user_profiles
ALTER TABLE "user_profiles"
  ADD CONSTRAINT "user_profiles_height_cm_check" CHECK ("height_cm" > 0),
  ADD CONSTRAINT "user_profiles_current_weight_kg_check" CHECK ("current_weight_kg" > 0),
  ADD CONSTRAINT "user_profiles_target_weight_kg_check" CHECK ("target_weight_kg" > 0),
  ADD CONSTRAINT "user_profiles_pace_kg_per_week_check" CHECK ("pace_kg_per_week" >= 0);

-- AlterTable: Add CHECK constraints to nutrition_goals
ALTER TABLE "nutrition_goals"
  ADD CONSTRAINT "nutrition_goals_daily_calories_check" CHECK ("daily_calories" > 0),
  ADD CONSTRAINT "nutrition_goals_protein_grams_check" CHECK ("protein_grams" >= 0),
  ADD CONSTRAINT "nutrition_goals_carbs_grams_check" CHECK ("carbs_grams" >= 0),
  ADD CONSTRAINT "nutrition_goals_fat_grams_check" CHECK ("fat_grams" >= 0),
  ADD CONSTRAINT "nutrition_goals_fiber_grams_check" CHECK ("fiber_grams" >= 0),
  ADD CONSTRAINT "nutrition_goals_water_ml_check" CHECK ("water_ml" >= 0);

-- AlterTable: Add CHECK constraints to food_items
ALTER TABLE "food_items"
  ADD CONSTRAINT "food_items_serving_size_check" CHECK ("serving_size" > 0),
  ADD CONSTRAINT "food_items_standard_weight_grams_check" CHECK ("standard_weight_grams" > 0),
  ADD CONSTRAINT "food_items_calories_check" CHECK ("calories" >= 0),
  ADD CONSTRAINT "food_items_protein_check" CHECK ("protein" >= 0),
  ADD CONSTRAINT "food_items_carbs_check" CHECK ("carbs" >= 0),
  ADD CONSTRAINT "food_items_fat_check" CHECK ("fat" >= 0),
  ADD CONSTRAINT "food_items_fiber_check" CHECK ("fiber" >= 0);

-- AlterTable: Add CHECK constraints to serving_unit_conversions
ALTER TABLE "serving_unit_conversions"
  ADD CONSTRAINT "serving_unit_conversions_gram_weight_check" CHECK ("gram_weight" > 0),
  ADD CONSTRAINT "serving_unit_conversions_ml_volume_check" CHECK ("ml_volume" IS NULL OR "ml_volume" > 0);

-- AlterTable: Add CHECK constraints to meal_entries
ALTER TABLE "meal_entries"
  ADD CONSTRAINT "meal_entries_total_calories_check" CHECK ("total_calories" >= 0),
  ADD CONSTRAINT "meal_entries_total_protein_check" CHECK ("total_protein" >= 0),
  ADD CONSTRAINT "meal_entries_total_carbs_check" CHECK ("total_carbs" >= 0),
  ADD CONSTRAINT "meal_entries_total_fat_check" CHECK ("total_fat" >= 0);

-- AlterTable: Add CHECK constraints to meal_food_items
ALTER TABLE "meal_food_items"
  ADD CONSTRAINT "meal_food_items_portion_amount_check" CHECK ("portion_amount" > 0),
  ADD CONSTRAINT "meal_food_items_gram_weight_check" CHECK ("gram_weight" > 0),
  ADD CONSTRAINT "meal_food_items_calories_check" CHECK ("calories" >= 0),
  ADD CONSTRAINT "meal_food_items_protein_check" CHECK ("protein" >= 0),
  ADD CONSTRAINT "meal_food_items_carbs_check" CHECK ("carbs" >= 0),
  ADD CONSTRAINT "meal_food_items_fat_check" CHECK ("fat" >= 0),
  ADD CONSTRAINT "meal_food_items_confidence_score_check" CHECK ("confidence_score" IS NULL OR ("confidence_score" >= 0 AND "confidence_score" <= 1));

-- AlterTable: Add CHECK constraints to food_scan_logs
ALTER TABLE "food_scan_logs"
  ADD CONSTRAINT "food_scan_logs_latency_ms_check" CHECK ("latency_ms" >= 0);

-- AlterTable: Add CHECK constraints to weight_logs
ALTER TABLE "weight_logs"
  ADD CONSTRAINT "weight_logs_weight_kg_check" CHECK ("weight_kg" > 0);

-- AlterTable: Add CHECK constraints to water_logs
ALTER TABLE "water_logs"
  ADD CONSTRAINT "water_logs_amount_ml_check" CHECK ("amount_ml" >= 0);

