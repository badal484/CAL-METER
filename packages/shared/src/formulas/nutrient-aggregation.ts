import { NutrientProfile } from '../types/index.js';
import { roundTo } from '../utils/measurements.js';

/**
 * Aggregates multiple nutrient profiles (e.g. food items in a meal or meals across a day)
 * into a single unified nutrient summary.
 */
export function aggregateNutrients(profiles: NutrientProfile[]): NutrientProfile {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber: number | undefined = undefined;
  const mergedMicros: Record<string, number> = {};

  for (const item of profiles) {
    totalCalories += item.calories;
    totalProtein += item.proteinGrams;
    totalCarbs += item.carbsGrams;
    totalFat += item.fatGrams;

    if (item.fiberGrams !== undefined) {
      totalFiber = (totalFiber ?? 0) + item.fiberGrams;
    }

    if (item.micronutrients) {
      for (const [key, val] of Object.entries(item.micronutrients)) {
        mergedMicros[key] = (mergedMicros[key] ?? 0) + val;
      }
    }
  }

  const roundedMicros =
    Object.keys(mergedMicros).length > 0
      ? Object.entries(mergedMicros).reduce((acc, [k, v]) => ({ ...acc, [k]: roundTo(v, 2) }), {})
      : undefined;

  return {
    calories: roundTo(totalCalories, 1),
    proteinGrams: roundTo(totalProtein, 1),
    carbsGrams: roundTo(totalCarbs, 1),
    fatGrams: roundTo(totalFat, 1),
    fiberGrams: totalFiber !== undefined ? roundTo(totalFiber, 1) : undefined,
    micronutrients: roundedMicros,
  };
}
