import { DomainValidationError } from '../errors/index.js';
import { NutrientProfile } from '../types/index.js';
import { roundTo } from '../utils/measurements.js';

/**
 * Aggregates multiple nutrient profiles (e.g. food items in a meal or meals across a day)
 * into a single unified nutrient summary.
 *
 * Validates that all incoming profiles contain finite non-negative values to prevent
 * invalid number propagation into daily summaries.
 */
export function aggregateNutrients(profiles: NutrientProfile[]): NutrientProfile {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber: number | undefined = undefined;
  const mergedMicros: Record<string, number> = {};

  for (let i = 0; i < profiles.length; i++) {
    const item = profiles[i]!;

    if (
      !Number.isFinite(item.calories) ||
      !Number.isFinite(item.proteinGrams) ||
      !Number.isFinite(item.carbsGrams) ||
      !Number.isFinite(item.fatGrams) ||
      item.calories < 0 ||
      item.proteinGrams < 0 ||
      item.carbsGrams < 0 ||
      item.fatGrams < 0
    ) {
      throw new DomainValidationError(
        `Profile at index ${i} contains non-finite or negative macronutrients (Calories: ${item.calories}, P: ${item.proteinGrams}, C: ${item.carbsGrams}, F: ${item.fatGrams}).`,
      );
    }

    totalCalories += item.calories;
    totalProtein += item.proteinGrams;
    totalCarbs += item.carbsGrams;
    totalFat += item.fatGrams;

    if (item.fiberGrams !== undefined) {
      if (!Number.isFinite(item.fiberGrams) || item.fiberGrams < 0) {
        throw new DomainValidationError(
          `Profile at index ${i} contains non-finite or negative fiber (${item.fiberGrams}).`,
        );
      }
      totalFiber = (totalFiber ?? 0) + item.fiberGrams;
    }

    if (item.micronutrients) {
      for (const [key, val] of Object.entries(item.micronutrients)) {
        if (!Number.isFinite(val) || val < 0) {
          throw new DomainValidationError(
            `Profile at index ${i} contains non-finite or negative micronutrient '${key}' (${val}).`,
          );
        }
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
