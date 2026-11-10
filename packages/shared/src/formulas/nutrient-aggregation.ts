import { DomainValidationError } from '../errors/index.js';
import { NutrientProfile } from '../types/index.js';
import { roundTo } from '../utils/measurements.js';

/**
 * Aggregates multiple nutrient profiles (e.g. food items in a meal or meals across a day)
 * into a single unified nutrient summary.
 *
 * Health & Safety / Engineering Principles:
 * 1. Validates that all incoming individual profile fields contain finite non-negative values.
 * 2. Validates accumulated totals after addition to prevent and reject numeric overflow
 *    (e.g., from individually finite but massive IEEE-754 double precision floating-point numbers).
 * 3. Never allows invalid or overflowed numbers to propagate into daily nutrition summaries.
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

  // Post-addition accumulation overflow validation
  if (!Number.isFinite(totalCalories)) {
    throw new DomainValidationError(
      `Accumulated calories overflowed or became non-finite (${totalCalories}).`,
    );
  }
  if (!Number.isFinite(totalProtein)) {
    throw new DomainValidationError(
      `Accumulated protein overflowed or became non-finite (${totalProtein}).`,
    );
  }
  if (!Number.isFinite(totalCarbs)) {
    throw new DomainValidationError(
      `Accumulated carbohydrates overflowed or became non-finite (${totalCarbs}).`,
    );
  }
  if (!Number.isFinite(totalFat)) {
    throw new DomainValidationError(
      `Accumulated fat overflowed or became non-finite (${totalFat}).`,
    );
  }
  if (totalFiber !== undefined && !Number.isFinite(totalFiber)) {
    throw new DomainValidationError(
      `Accumulated dietary fiber overflowed or became non-finite (${totalFiber}).`,
    );
  }
  for (const [key, val] of Object.entries(mergedMicros)) {
    if (!Number.isFinite(val)) {
      throw new DomainValidationError(
        `Accumulated micronutrient '${key}' overflowed or became non-finite (${val}).`,
      );
    }
  }

  const roundedCalories = roundTo(totalCalories, 1);
  const roundedProtein = roundTo(totalProtein, 1);
  const roundedCarbs = roundTo(totalCarbs, 1);
  const roundedFat = roundTo(totalFat, 1);
  const roundedFiber = totalFiber !== undefined ? roundTo(totalFiber, 1) : undefined;

  if (
    !Number.isFinite(roundedCalories) ||
    !Number.isFinite(roundedProtein) ||
    !Number.isFinite(roundedCarbs) ||
    !Number.isFinite(roundedFat) ||
    (roundedFiber !== undefined && !Number.isFinite(roundedFiber))
  ) {
    throw new DomainValidationError(
      'Aggregated nutrition totals produced non-finite values after decimal rounding.',
    );
  }

  let roundedMicros: Record<string, number> | undefined = undefined;
  if (Object.keys(mergedMicros).length > 0) {
    roundedMicros = {};
    for (const [k, v] of Object.entries(mergedMicros)) {
      const roundedVal = roundTo(v, 2);
      if (!Number.isFinite(roundedVal)) {
        throw new DomainValidationError(
          `Aggregated micronutrient '${k}' produced a non-finite value after decimal rounding (${roundedVal}).`,
        );
      }
      roundedMicros[k] = roundedVal;
    }
  }

  return {
    calories: roundedCalories,
    proteinGrams: roundedProtein,
    carbsGrams: roundedCarbs,
    fatGrams: roundedFat,
    fiberGrams: roundedFiber,
    micronutrients: roundedMicros,
  };
}
