import { FoodSource } from '@calmeter/shared';
import type { IFoodSourceAdapter, NormalizedFoodRecord } from '../types.js';

interface OffNutriments {
  'energy-kcal_100g'?: number;
  'energy-kcal'?: number;
  proteins_100g?: number;
  proteins?: number;
  carbohydrates_100g?: number;
  carbohydrates?: number;
  fat_100g?: number;
  fat?: number;
  'saturated-fat_100g'?: number;
  'saturated-fat'?: number;
  'trans-fat_100g'?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  'added-sugars_100g'?: number;
  sodium_100g?: number; // In grams in OFF standard, need mg
  salt_100g?: number;
  cholesterol_100g?: number;
  potassium_100g?: number;
  calcium_100g?: number;
  iron_100g?: number;
}

interface OffProduct {
  code: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments?: OffNutriments;
  categories_tags?: string[];
  countries_tags?: string[];
}

export class OpenFoodFactsAdapter implements IFoodSourceAdapter {
  readonly source = FoodSource.OPEN_FOOD_FACTS;
  readonly sourceName = 'Open Food Facts';
  readonly license = 'Open Database License (ODbL) v1.0';
  readonly attribution = 'Data sourced from Open Food Facts (ODbL 1.0) community contributors.';

  normalizeRecord(raw: unknown): NormalizedFoodRecord {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Raw Open Food Facts record must be a non-null object.');
    }
    const item = raw as OffProduct;

    const name = (item.product_name || item.product_name_en || '').trim();
    if (!name) {
      throw new Error('Open Food Facts product record must contain a valid product name.');
    }

    const nutriments = item.nutriments || {};

    const calories = Number(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? 0);
    const protein = Number(nutriments.proteins_100g ?? nutriments.proteins ?? 0);
    const carbs = Number(nutriments.carbohydrates_100g ?? nutriments.carbohydrates ?? 0);
    const fat = Number(nutriments.fat_100g ?? nutriments.fat ?? 0);

    const saturatedFat =
      nutriments['saturated-fat_100g'] !== undefined
        ? Number(nutriments['saturated-fat_100g'])
        : null;
    const transFat =
      nutriments['trans-fat_100g'] !== undefined ? Number(nutriments['trans-fat_100g']) : null;
    const fiber = nutriments.fiber_100g !== undefined ? Number(nutriments.fiber_100g) : null;
    const sugar = nutriments.sugars_100g !== undefined ? Number(nutriments.sugars_100g) : null;
    const addedSugar =
      nutriments['added-sugars_100g'] !== undefined
        ? Number(nutriments['added-sugars_100g'])
        : null;

    // Open Food Facts reports sodium in grams per 100g. Convert to mg (x 1000).
    let sodium: number | null = null;
    if (nutriments.sodium_100g !== undefined) {
      sodium = Math.round(Number(nutriments.sodium_100g) * 1000);
    } else if (nutriments.salt_100g !== undefined) {
      // Salt (NaCl) is ~38.758% sodium by mass
      sodium = Math.round(Number(nutriments.salt_100g) * 387.58);
    }

    const cholesterol =
      nutriments.cholesterol_100g !== undefined
        ? Math.round(Number(nutriments.cholesterol_100g) * 1000) // g to mg
        : null;

    const potassium =
      nutriments.potassium_100g !== undefined
        ? Math.round(Number(nutriments.potassium_100g) * 1000)
        : null;

    const calcium =
      nutriments.calcium_100g !== undefined
        ? Math.round(Number(nutriments.calcium_100g) * 1000)
        : null;

    const iron =
      nutriments.iron_100g !== undefined ? Math.round(Number(nutriments.iron_100g) * 1000) : null;

    const servings = [];
    if (item.serving_quantity && Number(item.serving_quantity) > 0) {
      servings.push({
        unitName: 'serving',
        servingDescription: item.serving_size || '1 serving',
        gramWeight: Number(item.serving_quantity),
        provenance: 'MANUFACTURER',
        isDefault: true,
      });
    }

    return {
      name,
      brand: item.brands ? item.brands.split(',')[0]?.trim() : undefined,
      barcode: item.code ? String(item.code).trim() : undefined,
      source: this.source,
      externalId: item.code ? String(item.code).trim() : undefined,
      cuisine: 'GLOBAL',
      categorySlug: 'packaged-foods',
      state: 'PREPARED',
      servingSize: 100,
      servingUnit: 'g',
      standardWeightGrams: 100,
      confidenceScore: 0.9,
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
        addedSugar,
        sodium,
        cholesterol,
        potassium,
        calcium,
        iron,
        vitaminD: null,
        vitaminB12: null,
        micronutrients: {},
      },
      servings,
      aliases: [],
    };
  }

  validateRecord(normalized: NormalizedFoodRecord): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!normalized.name || normalized.name.trim().length === 0) {
      errors.push('Open Food Facts product name cannot be empty.');
    }
    if (!normalized.barcode) {
      errors.push('Open Food Facts record must have a barcode.');
    }
    if (!Number.isFinite(normalized.nutrients.calories) || normalized.nutrients.calories < 0) {
      errors.push('Calories must be non-negative finite number.');
    }
    return { isValid: errors.length === 0, errors };
  }
}
