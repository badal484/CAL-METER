import { DomainValidationError } from '../errors/index.js';
import { NutrientProfile } from '../types/index.js';
import { roundTo } from '../utils/measurements.js';

/**
 * Deterministically scales a food item's nutrient profile from a reference quantity
 * (usually 100g or 1 package) to an arbitrary target gram weight.
 */
export function scaleNutrients(
  baseNutrients: NutrientProfile,
  targetGrams: number,
  referenceGrams: number = 100,
): NutrientProfile {
  if (targetGrams < 0) {
    throw new DomainValidationError('Target weight cannot be negative.');
  }

  if (referenceGrams <= 0) {
    throw new DomainValidationError('Reference weight must be greater than zero.');
  }

  if (targetGrams === 0) {
    return {
      calories: 0,
      proteinGrams: 0,
      carbsGrams: 0,
      fatGrams: 0,
      fiberGrams: baseNutrients.fiberGrams !== undefined ? 0 : undefined,
      micronutrients: baseNutrients.micronutrients
        ? Object.keys(baseNutrients.micronutrients).reduce((acc, key) => ({ ...acc, [key]: 0 }), {})
        : undefined,
    };
  }

  const factor = targetGrams / referenceGrams;

  const scaledMicronutrients: Record<string, number> | undefined = baseNutrients.micronutrients
    ? Object.entries(baseNutrients.micronutrients).reduce(
        (acc, [key, val]) => ({
          ...acc,
          [key]: roundTo(val * factor, 2),
        }),
        {},
      )
    : undefined;

  return {
    calories: roundTo(baseNutrients.calories * factor, 1),
    proteinGrams: roundTo(baseNutrients.proteinGrams * factor, 1),
    carbsGrams: roundTo(baseNutrients.carbsGrams * factor, 1),
    fatGrams: roundTo(baseNutrients.fatGrams * factor, 1),
    fiberGrams:
      baseNutrients.fiberGrams !== undefined
        ? roundTo(baseNutrients.fiberGrams * factor, 1)
        : undefined,
    micronutrients: scaledMicronutrients,
  };
}
