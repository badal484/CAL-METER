import { DomainValidationError } from '../errors/index.js';
import { NutrientProfile } from '../types/index.js';
import { roundTo } from '../utils/measurements.js';

/**
 * Deterministically scales a food item's nutrient profile from a reference quantity
 * (usually 100g or 1 package) to an arbitrary target gram weight.
 *
 * Enforces strict finite non-negative numeric validation.
 */
export function scaleNutrients(
  baseNutrients: NutrientProfile,
  targetGrams: number,
  referenceGrams: number = 100,
): NutrientProfile {
  if (!Number.isFinite(targetGrams) || targetGrams < 0) {
    throw new DomainValidationError(
      `Target weight must be a non-negative finite number (received: ${targetGrams}).`,
    );
  }

  if (!Number.isFinite(referenceGrams) || referenceGrams <= 0) {
    throw new DomainValidationError(
      `Reference weight must be a positive finite number (received: ${referenceGrams}).`,
    );
  }

  // Validate base nutrient profile
  const requiredNutrients: Array<
    keyof Pick<NutrientProfile, 'calories' | 'proteinGrams' | 'carbsGrams' | 'fatGrams'>
  > = ['calories', 'proteinGrams', 'carbsGrams', 'fatGrams'];

  for (const key of requiredNutrients) {
    const val = baseNutrients[key];
    if (!Number.isFinite(val) || val < 0) {
      throw new DomainValidationError(
        `Base nutrient '${key}' must be a non-negative finite number (received: ${val}).`,
      );
    }
  }

  if (baseNutrients.fiberGrams !== undefined) {
    if (!Number.isFinite(baseNutrients.fiberGrams) || baseNutrients.fiberGrams < 0) {
      throw new DomainValidationError(
        `Base nutrient 'fiberGrams' must be a non-negative finite number (received: ${baseNutrients.fiberGrams}).`,
      );
    }
  }

  if (baseNutrients.micronutrients) {
    for (const [key, val] of Object.entries(baseNutrients.micronutrients)) {
      if (!Number.isFinite(val) || val < 0) {
        throw new DomainValidationError(
          `Micronutrient '${key}' must be a non-negative finite number (received: ${val}).`,
        );
      }
    }
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
