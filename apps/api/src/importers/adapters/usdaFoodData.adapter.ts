import { FoodSource } from '@calmeter/shared';
import type { IFoodSourceAdapter, NormalizedFoodRecord } from '../types.js';

interface UsdaNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  value: number;
  unitName?: string;
}

interface UsdaFoodPortion {
  id?: number;
  amount?: number;
  modifier?: string;
  gramWeight?: number;
  measureUnit?: {
    name?: string;
  };
}

interface UsdaFoodItem {
  fdcId: number;
  description: string;
  foodNutrients: UsdaNutrient[];
  foodPortions?: UsdaFoodPortion[];
  dataType?: string;
  brandOwner?: string;
  gtinUpc?: string;
}

export class UsdaFoodDataAdapter implements IFoodSourceAdapter {
  readonly source = FoodSource.USDA_FOOD_DATA_CENTRAL;
  readonly sourceName = 'USDA FoodData Central';
  readonly license = 'US Public Domain / CC0 1.0 Universal';
  readonly attribution =
    'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2024.';

  normalizeRecord(raw: unknown): NormalizedFoodRecord {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Raw USDA record must be a non-null object.');
    }
    const item = raw as UsdaFoodItem;

    if (!item.fdcId || !item.description) {
      throw new Error('USDA food record must contain fdcId and description.');
    }

    const nutrientsMap = new Map<string, number>();
    for (const n of item.foodNutrients || []) {
      const key = String(n.nutrientNumber || n.nutrientId || n.nutrientName || '').toLowerCase();
      nutrientsMap.set(key, Number(n.value));
      if (n.nutrientName) {
        nutrientsMap.set(n.nutrientName.toLowerCase(), Number(n.value));
      }
    }

    // Lookup helper
    const getNutrient = (keys: string[]): number | null => {
      for (const k of keys) {
        const val = nutrientsMap.get(k.toLowerCase());
        if (val !== undefined && Number.isFinite(val)) {
          return val;
        }
      }
      return null;
    };

    const calories = getNutrient(['208', '1008', 'energy', 'energy (kcal)']) ?? 0;
    const protein = getNutrient(['203', '1003', 'protein']) ?? 0;
    const carbs = getNutrient(['205', '1005', 'carbohydrate, by difference']) ?? 0;
    const fat = getNutrient(['204', '1004', 'total lipid (fat)']) ?? 0;
    const fiber = getNutrient(['291', '1079', 'fiber, total dietary']);
    const sugar = getNutrient(['269', '2000', 'sugars, total including nlea', 'total sugars']);
    const saturatedFat = getNutrient(['606', '1258', 'fatty acids, total saturated']);
    const transFat = getNutrient(['605', '1257', 'fatty acids, total trans']);
    const cholesterol = getNutrient(['601', '1253', 'cholesterol']);
    const sodium = getNutrient(['307', '1093', 'sodium, na']);
    const potassium = getNutrient(['306', '1092', 'potassium, k']);
    const calcium = getNutrient(['301', '1087', 'calcium, ca']);
    const iron = getNutrient(['303', '1089', 'iron, fe']);
    const vitaminD = getNutrient(['328', '1114', 'vitamin d (d2 + d3)']);
    const vitaminB12 = getNutrient(['418', '1178', 'vitamin b-12']);

    const servings = (item.foodPortions || [])
      .filter(p => Number.isFinite(p.gramWeight) && Number(p.gramWeight) > 0)
      .map(p => {
        const unit = p.modifier || p.measureUnit?.name || 'serving';
        return {
          unitName: unit.toLowerCase().slice(0, 50),
          servingDescription: p.amount ? `${p.amount} ${unit}` : unit,
          gramWeight: Number(p.gramWeight),
          provenance: 'USDA_MEASURED',
          isDefault: false,
        };
      });

    return {
      name: item.description.trim(),
      brand: item.brandOwner ? item.brandOwner.trim() : undefined,
      barcode: item.gtinUpc ? item.gtinUpc.trim() : undefined,
      source: this.source,
      externalId: String(item.fdcId),
      cuisine: 'GLOBAL',
      categorySlug: 'global-staples',
      state: 'COOKED',
      servingSize: 100,
      servingUnit: 'g',
      standardWeightGrams: 100,
      confidenceScore: 0.98,
      isVerified: true,
      nutrients: {
        calories,
        protein,
        carbs,
        fat,
        saturatedFat,
        transFat,
        fiber,
        sugar,
        addedSugar: null,
        sodium,
        cholesterol,
        potassium,
        calcium,
        iron,
        vitaminD,
        vitaminB12,
        micronutrients: {},
      },
      servings,
      aliases: [],
    };
  }

  validateRecord(normalized: NormalizedFoodRecord): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!normalized.name || normalized.name.trim().length === 0) {
      errors.push('USDA food name cannot be empty.');
    }
    if (!normalized.externalId) {
      errors.push('USDA externalId (fdcId) is required.');
    }
    if (!Number.isFinite(normalized.nutrients.calories) || normalized.nutrients.calories < 0) {
      errors.push('Calories must be non-negative finite number.');
    }
    return { isValid: errors.length === 0, errors };
  }
}
