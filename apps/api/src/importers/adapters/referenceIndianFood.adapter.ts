import { FoodSource } from '@calmeter/shared';
import type { IFoodSourceAdapter, NormalizedFoodRecord } from '../types.js';

export class ReferenceIndianFoodAdapter implements IFoodSourceAdapter {
  readonly source = FoodSource.INDIAN_FCT_NIN;
  readonly sourceName = 'Indian Culinary & Food Composition Reference';
  readonly license = 'Government Reference / Culinary Standard Guideline';
  readonly attribution =
    'Standard culinary formulation based on Indian regional recipes and nutritional reference tables';

  normalizeRecord(raw: unknown): NormalizedFoodRecord {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Raw input record must be a non-null object.');
    }
    const r = raw as Record<string, unknown>;

    const name = String(r.name || '').trim();
    if (!name) {
      throw new Error('Reference food record must have a non-empty name.');
    }

    const nutrients = (r.nutrients as Record<string, unknown>) || {};
    const servings = Array.isArray(r.servings) ? r.servings : [];
    const aliases = Array.isArray(r.aliases) ? r.aliases : [];
    const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];

    return {
      name,
      localNames: Array.isArray(r.localNames) ? (r.localNames as string[]) : [],
      brand: r.brand ? String(r.brand).trim() : undefined,
      barcode: r.barcode ? String(r.barcode).trim() : undefined,
      source: this.source,
      externalId: r.externalId ? String(r.externalId).trim() : undefined,
      cuisine: r.cuisine ? String(r.cuisine).trim() : 'INDIAN_NORTH',
      categorySlug: r.categorySlug ? String(r.categorySlug).trim() : undefined,
      state: (r.state as 'RAW' | 'COOKED' | 'PREPARED') || 'COOKED',
      prepMethod: r.prepMethod ? String(r.prepMethod).trim() : undefined,
      servingSize: Number(r.servingSize) || 100,
      servingUnit: String(r.servingUnit || 'g').trim(),
      standardWeightGrams: Number(r.standardWeightGrams) || 100,
      confidenceScore: typeof r.confidenceScore === 'number' ? r.confidenceScore : 0.95,
      isVerified: true,
      nutrients: {
        calories: Number(nutrients.calories ?? 0),
        protein: Number(nutrients.protein ?? 0),
        carbs: Number(nutrients.carbs ?? 0),
        fat: Number(nutrients.fat ?? 0),
        saturatedFat:
          nutrients.saturatedFat !== undefined && nutrients.saturatedFat !== null
            ? Number(nutrients.saturatedFat)
            : null,
        transFat:
          nutrients.transFat !== undefined && nutrients.transFat !== null
            ? Number(nutrients.transFat)
            : null,
        fiber:
          nutrients.fiber !== undefined && nutrients.fiber !== null
            ? Number(nutrients.fiber)
            : null,
        sugar:
          nutrients.sugar !== undefined && nutrients.sugar !== null
            ? Number(nutrients.sugar)
            : null,
        addedSugar:
          nutrients.addedSugar !== undefined && nutrients.addedSugar !== null
            ? Number(nutrients.addedSugar)
            : null,
        sodium:
          nutrients.sodium !== undefined && nutrients.sodium !== null
            ? Number(nutrients.sodium)
            : null,
        cholesterol:
          nutrients.cholesterol !== undefined && nutrients.cholesterol !== null
            ? Number(nutrients.cholesterol)
            : null,
        potassium:
          nutrients.potassium !== undefined && nutrients.potassium !== null
            ? Number(nutrients.potassium)
            : null,
        calcium:
          nutrients.calcium !== undefined && nutrients.calcium !== null
            ? Number(nutrients.calcium)
            : null,
        iron:
          nutrients.iron !== undefined && nutrients.iron !== null ? Number(nutrients.iron) : null,
        vitaminD:
          nutrients.vitaminD !== undefined && nutrients.vitaminD !== null
            ? Number(nutrients.vitaminD)
            : null,
        vitaminB12:
          nutrients.vitaminB12 !== undefined && nutrients.vitaminB12 !== null
            ? Number(nutrients.vitaminB12)
            : null,
        micronutrients: (nutrients.micronutrients as Record<string, number>) || {},
      },
      servings: servings.map((s: Record<string, unknown>) => ({
        unitName: String(s.unitName || '').trim(),
        servingDescription: s.servingDescription ? String(s.servingDescription).trim() : undefined,
        gramWeight: Number(s.gramWeight || 0),
        mlVolume: s.mlVolume ? Number(s.mlVolume) : undefined,
        provenance: String(s.provenance || 'REFERENCE_RECIPE').trim(),
        isDefault: Boolean(s.isDefault),
      })),
      aliases: aliases.map((a: Record<string, unknown>) => ({
        alias: String(a.alias || '').trim(),
        language: a.language ? String(a.language).trim() : undefined,
        isPrimary: Boolean(a.isPrimary),
      })),
      ingredients: ingredients.map((ing: Record<string, unknown>, idx: number) => ({
        ingredientName: String(ing.ingredientName || '').trim(),
        gramWeight: ing.gramWeight ? Number(ing.gramWeight) : undefined,
        notes: ing.notes ? String(ing.notes).trim() : undefined,
        orderIndex: typeof ing.orderIndex === 'number' ? ing.orderIndex : idx,
      })),
    };
  }

  validateRecord(normalized: NormalizedFoodRecord): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!normalized.name || normalized.name.trim().length === 0) {
      errors.push('Food name cannot be empty.');
    }
    if (!Number.isFinite(normalized.nutrients.calories) || normalized.nutrients.calories < 0) {
      errors.push('Calories must be a finite non-negative number.');
    }
    if (!Number.isFinite(normalized.nutrients.protein) || normalized.nutrients.protein < 0) {
      errors.push('Protein must be a finite non-negative number.');
    }
    if (!Number.isFinite(normalized.nutrients.carbs) || normalized.nutrients.carbs < 0) {
      errors.push('Carbohydrates must be a finite non-negative number.');
    }
    if (!Number.isFinite(normalized.nutrients.fat) || normalized.nutrients.fat < 0) {
      errors.push('Fat must be a finite non-negative number.');
    }

    // Check optional nutrients if present
    const checkOptional = (val: number | null | undefined, name: string) => {
      if (val !== undefined && val !== null) {
        if (!Number.isFinite(val) || val < 0) {
          errors.push(`Nutrient '${name}' must be a finite non-negative number.`);
        }
      }
    };

    checkOptional(normalized.nutrients.saturatedFat, 'saturatedFat');
    checkOptional(normalized.nutrients.transFat, 'transFat');
    checkOptional(normalized.nutrients.fiber, 'fiber');
    checkOptional(normalized.nutrients.sugar, 'sugar');
    checkOptional(normalized.nutrients.addedSugar, 'addedSugar');
    checkOptional(normalized.nutrients.sodium, 'sodium');
    checkOptional(normalized.nutrients.calcium, 'calcium');
    checkOptional(normalized.nutrients.iron, 'iron');

    for (const serving of normalized.servings) {
      if (!serving.unitName) {
        errors.push('Serving unitName cannot be empty.');
      }
      if (!Number.isFinite(serving.gramWeight) || serving.gramWeight <= 0) {
        errors.push(
          `Serving gramWeight for '${serving.unitName}' must be a positive finite number.`,
        );
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}
