import { ATWATER_FACTORS, FIBER_GRAMS_PER_1000_KCAL } from '../constants/macro-ratios.js';
import { DomainValidationError } from '../errors/index.js';
import { MacroCalculationInput, MacroTargetResult } from '../types/index.js';
import { roundTo } from '../utils/measurements.js';

/**
 * Calculates deterministic macronutrient gram and calorie targets.
 *
 * Rules & Energetic Densities (Atwater Factors):
 * - Protein yields 4 kcal/gram.
 * - Carbohydrates yield 4 kcal/gram.
 * - Fat yields 9 kcal/gram.
 * - Fiber recommendations default to 14g per 1,000 kcal (Dietary Reference Intake).
 *
 * Rounding Specification:
 * - Macronutrient grams and fiber are rounded to 1 decimal place (`roundTo(val, 1)`).
 * - Calorie contributions from individual macronutrients are rounded to whole numbers (`roundTo(val, 0)`).
 * - Fractional percentages are rounded to 3 decimal places (`roundTo(val, 3)`).
 */
export function calculateMacronutrients(input: MacroCalculationInput): MacroTargetResult {
  const {
    dailyCalories,
    proteinPercentage = 0.3,
    carbsPercentage = 0.4,
    fatPercentage = 0.3,
    customProteinGrams,
    customCarbsGrams,
    customFatGrams,
  } = input;

  if (!Number.isFinite(dailyCalories) || dailyCalories <= 0) {
    throw new DomainValidationError(
      `Daily calories must be a positive finite number (received: ${dailyCalories}).`,
    );
  }

  // Check for partial custom macro inputs
  const customProvided = [customProteinGrams, customCarbsGrams, customFatGrams].filter(
    v => v !== undefined,
  );

  if (customProvided.length > 0 && customProvided.length < 3) {
    throw new DomainValidationError(
      'All three custom macronutrient gram values (protein, carbs, fat) must be provided together. Partial custom inputs are not permitted.',
    );
  }

  // If complete custom gram amounts are explicitly supplied
  if (
    customProteinGrams !== undefined &&
    customCarbsGrams !== undefined &&
    customFatGrams !== undefined
  ) {
    if (
      !Number.isFinite(customProteinGrams) ||
      !Number.isFinite(customCarbsGrams) ||
      !Number.isFinite(customFatGrams)
    ) {
      throw new DomainValidationError('Custom macronutrient gram values must be finite numbers.');
    }

    if (customProteinGrams < 0 || customCarbsGrams < 0 || customFatGrams < 0) {
      throw new DomainValidationError('Custom macronutrient gram values cannot be negative.');
    }

    const proteinCalories = roundTo(customProteinGrams * ATWATER_FACTORS.PROTEIN, 0);
    const carbsCalories = roundTo(customCarbsGrams * ATWATER_FACTORS.CARBOHYDRATE, 0);
    const fatCalories = roundTo(customFatGrams * ATWATER_FACTORS.FAT, 0);
    const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;

    const proteinPct =
      totalMacroCalories > 0 ? roundTo(proteinCalories / totalMacroCalories, 3) : 0;
    const carbsPct = totalMacroCalories > 0 ? roundTo(carbsCalories / totalMacroCalories, 3) : 0;
    const fatPct = totalMacroCalories > 0 ? roundTo(fatCalories / totalMacroCalories, 3) : 0;
    const fiberGrams = Math.max(roundTo((dailyCalories / 1000) * FIBER_GRAMS_PER_1000_KCAL, 1), 15);

    return {
      dailyCalories,
      proteinGrams: roundTo(customProteinGrams, 1),
      carbsGrams: roundTo(customCarbsGrams, 1),
      fatGrams: roundTo(customFatGrams, 1),
      fiberGrams,
      proteinCalories,
      carbsCalories,
      fatCalories,
      proteinPercentage: proteinPct,
      carbsPercentage: carbsPct,
      fatPercentage: fatPct,
    };
  }

  // Validate percentage inputs individually
  if (
    !Number.isFinite(proteinPercentage) ||
    !Number.isFinite(carbsPercentage) ||
    !Number.isFinite(fatPercentage)
  ) {
    throw new DomainValidationError('Macronutrient percentages must be finite numbers.');
  }

  if (proteinPercentage < 0 || carbsPercentage < 0 || fatPercentage < 0) {
    throw new DomainValidationError('Macronutrient percentages cannot be negative.');
  }

  if (proteinPercentage > 1 || carbsPercentage > 1 || fatPercentage > 1) {
    throw new DomainValidationError(
      'Individual macronutrient percentages cannot exceed 1.0 (100%).',
    );
  }

  const sumOfPercentages = proteinPercentage + carbsPercentage + fatPercentage;
  if (Math.abs(sumOfPercentages - 1.0) > 0.015) {
    throw new DomainValidationError(
      `Macronutrient percentages must sum to 100% (1.0). Current sum: ${roundTo(sumOfPercentages * 100, 1)}%`,
    );
  }

  const proteinCalories = roundTo(dailyCalories * proteinPercentage, 0);
  const carbsCalories = roundTo(dailyCalories * carbsPercentage, 0);
  const fatCalories = roundTo(dailyCalories * fatPercentage, 0);

  const proteinGrams = roundTo(proteinCalories / ATWATER_FACTORS.PROTEIN, 1);
  const carbsGrams = roundTo(carbsCalories / ATWATER_FACTORS.CARBOHYDRATE, 1);
  const fatGrams = roundTo(fatCalories / ATWATER_FACTORS.FAT, 1);
  const fiberGrams = Math.max(roundTo((dailyCalories / 1000) * FIBER_GRAMS_PER_1000_KCAL, 1), 15);

  return {
    dailyCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    fiberGrams,
    proteinCalories,
    carbsCalories,
    fatCalories,
    proteinPercentage: roundTo(proteinPercentage, 3),
    carbsPercentage: roundTo(carbsPercentage, 3),
    fatPercentage: roundTo(fatPercentage, 3),
  };
}
