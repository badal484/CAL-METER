import {
  scaleNutrients,
  convertServingToGrams,
  aggregateNutrients,
  roundTo,
  NutrientProfile,
  DomainValidationError,
} from '@calmeter/shared';

export interface FoodItemWithNutrition {
  id: string;
  name: string;
  standardWeightGrams?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  nutrientProfile?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    saturatedFat?: number | null;
    transFat?: number | null;
    fiber?: number | null;
    sugar?: number | null;
    addedSugar?: number | null;
    sodium?: number | null;
    cholesterol?: number | null;
    potassium?: number | null;
    calcium?: number | null;
    iron?: number | null;
    vitaminD?: number | null;
    vitaminB12?: number | null;
    micronutrients?: Record<string, number | null>;
  } | null;
  servingConversions?: Array<{
    id?: string;
    unitName: string;
    servingDescription?: string | null;
    gramWeight: number;
    mlVolume?: number | null;
    isDefault?: boolean;
    provenance?: string;
  }>;
}

export interface CalculatedItemResult {
  candidateId: string;
  foodItemId: string;
  foodName: string;
  portionQuantity: number;
  portionUnit: string;
  resolvedGramWeight: number;
  gramWeightProvenance: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sodium: number | null;
  sugar: number | null;
  saturatedFat: number | null;
  micronutrients: Record<string, number | null>;
  provenance: string;
}

export interface AggregateNutritionSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sodium: number | null;
  sugar: number | null;
  itemCount: number;
  micronutrients: Record<string, number | null>;
}

export class NutritionCalculationService {
  /**
   * Calculates deterministic nutritional values for a single food item based on
   * confirmed/estimated portion quantity and unit.
   */
  calculateItemNutrition(
    candidateId: string,
    food: FoodItemWithNutrition,
    quantity: number,
    unit: string,
    fallbackEstimatedGrams?: number,
  ): CalculatedItemResult {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new DomainValidationError(
        `Portion quantity must be a positive finite number (received: ${quantity}).`,
      );
    }

    // 1. Resolve unit to grams using food-specific conversions
    const rawConversions: any[] = (food.servingConversions || []).map(c => ({
      id: c.id || 'default-conv',
      foodItemId: food.id,
      unit: (c as any).unit || c.unitName || 'piece',
      unitName: c.unitName || (c as any).unit || 'piece',
      servingDescription: c.servingDescription || undefined,
      gramWeight: Number(c.gramWeight),
      mlVolume: c.mlVolume ? Number(c.mlVolume) : undefined,
      provenance: (c.provenance as any) || 'REFERENCE_CURATED',
      isDefault: Boolean(c.isDefault),
    }));

    const conversionResult = convertServingToGrams(rawConversions, unit, quantity);

    let resolvedGramWeight: number;
    let gramWeightProvenance = 'FOOD_SPECIFIC_CONVERSION';

    if (conversionResult.success) {
      resolvedGramWeight = conversionResult.gramWeight;
      gramWeightProvenance = conversionResult.provenance;
    } else if (fallbackEstimatedGrams && fallbackEstimatedGrams > 0) {
      resolvedGramWeight = roundTo(fallbackEstimatedGrams, 1);
      gramWeightProvenance = 'AI_ESTIMATED_WEIGHT';
    } else {
      // Default to standard weight if unit is a general piece/serving
      const stdWeight = Number(food.standardWeightGrams) || 100;
      resolvedGramWeight = roundTo(quantity * stdWeight, 1);
      gramWeightProvenance = 'STANDARD_DEFAULT_WEIGHT';
    }

    if (!Number.isFinite(resolvedGramWeight) || resolvedGramWeight <= 0) {
      throw new DomainValidationError(
        `Unable to determine positive gram weight for food '${food.name}' with portion ${quantity} ${unit}.`,
      );
    }

    // 2. Base 100g nutrient profile
    const profile = food.nutrientProfile;
    const baseCalories = profile ? Number(profile.calories) : Number(food.calories);
    const baseProtein = profile ? Number(profile.protein) : Number(food.protein);
    const baseCarbs = profile ? Number(profile.carbs) : Number(food.carbs);
    const baseFat = profile ? Number(profile.fat) : Number(food.fat);
    const baseFiber =
      profile?.fiber != null
        ? Number(profile.fiber)
        : food.fiber != null
          ? Number(food.fiber)
          : null;

    // Use shared scaleNutrients formula for core macros
    const baseProfile: NutrientProfile = {
      calories: baseCalories,
      proteinGrams: baseProtein,
      carbsGrams: baseCarbs,
      fatGrams: baseFat,
      fiberGrams: baseFiber != null ? baseFiber : undefined,
    };

    const scaled = scaleNutrients(baseProfile, resolvedGramWeight, 100);

    // 3. Scale detailed micronutrients preserving null vs 0
    const factor = resolvedGramWeight / 100;

    const scaleNullable = (val?: number | null): number | null => {
      if (val === null || val === undefined) return null;
      if (!Number.isFinite(Number(val))) {
        throw new DomainValidationError('Encountered non-finite micronutrient during scaling.');
      }
      return roundTo(Number(val) * factor, 2);
    };

    const scaledSodium = scaleNullable(profile?.sodium);
    const scaledSugar = scaleNullable(profile?.sugar);
    const scaledSaturatedFat = scaleNullable(profile?.saturatedFat);

    // Scaling extra micronutrients in json column
    const scaledExtraMicros: Record<string, number | null> = {};
    if (profile?.micronutrients && typeof profile.micronutrients === 'object') {
      for (const [key, val] of Object.entries(profile.micronutrients)) {
        scaledExtraMicros[key] = scaleNullable(val as any);
      }
    }

    if (profile?.potassium !== undefined)
      scaledExtraMicros.potassium = scaleNullable(profile.potassium);
    if (profile?.calcium !== undefined) scaledExtraMicros.calcium = scaleNullable(profile.calcium);
    if (profile?.iron !== undefined) scaledExtraMicros.iron = scaleNullable(profile.iron);
    if (profile?.vitaminD !== undefined)
      scaledExtraMicros.vitaminD = scaleNullable(profile.vitaminD);
    if (profile?.vitaminB12 !== undefined)
      scaledExtraMicros.vitaminB12 = scaleNullable(profile.vitaminB12);

    return {
      candidateId,
      foodItemId: food.id,
      foodName: food.name,
      portionQuantity: quantity,
      portionUnit: unit,
      resolvedGramWeight,
      gramWeightProvenance,
      calories: scaled.calories,
      protein: scaled.proteinGrams,
      carbs: scaled.carbsGrams,
      fat: scaled.fatGrams,
      fiber: scaled.fiberGrams !== undefined ? scaled.fiberGrams : null,
      sodium: scaledSodium,
      sugar: scaledSugar,
      saturatedFat: scaledSaturatedFat,
      micronutrients: scaledExtraMicros,
      provenance: 'CALCULATED_BACKEND',
    };
  }

  /**
   * Aggregates nutrition across multiple items in a meal.
   */
  aggregateMealNutrition(items: CalculatedItemResult[]): AggregateNutritionSummary {
    if (items.length === 0) {
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: null,
        sodium: null,
        sugar: null,
        itemCount: 0,
        micronutrients: {},
      };
    }

    // Convert to NutrientProfile array for shared aggregation formula
    const profiles: NutrientProfile[] = items.map(item => ({
      calories: item.calories,
      proteinGrams: item.protein,
      carbsGrams: item.carbs,
      fatGrams: item.fat,
      fiberGrams: item.fiber != null ? item.fiber : undefined,
    }));

    const agg = aggregateNutrients(profiles);

    // Aggregate nullable nutrients (sodium, sugar, micronutrients)
    let totalSodium: number | null = null;
    let totalSugar: number | null = null;
    const aggMicros: Record<string, number> = {};

    for (const item of items) {
      if (item.sodium != null) {
        totalSodium = roundTo((totalSodium || 0) + item.sodium, 2);
      }
      if (item.sugar != null) {
        totalSugar = roundTo((totalSugar || 0) + item.sugar, 2);
      }
      for (const [key, val] of Object.entries(item.micronutrients)) {
        if (val != null) {
          aggMicros[key] = roundTo((aggMicros[key] || 0) + val, 2);
        }
      }
    }

    return {
      calories: agg.calories,
      protein: agg.proteinGrams,
      carbs: agg.carbsGrams,
      fat: agg.fatGrams,
      fiber: agg.fiberGrams !== undefined ? agg.fiberGrams : null,
      sodium: totalSodium,
      sugar: totalSugar,
      itemCount: items.length,
      micronutrients: aggMicros,
    };
  }
}

export const defaultNutritionCalculationService = new NutritionCalculationService();
