import {
  ATWATER_FACTORS,
  FIBER_GRAMS_PER_1000_KCAL,
  MACRO_PERCENTAGE_TOLERANCE,
  MACRO_ENERGY_CONSISTENCY_TOLERANCE_PCT,
  MACRO_ENERGY_CONSISTENCY_ABSOLUTE_KCAL,
} from '../constants/macro-ratios.js';
import { DomainValidationError } from '../errors/index.js';
import { MacroCalculationInput, MacroTargetResult } from '../types/index.js';
import { roundTo } from '../utils/measurements.js';

/**
 * Calculates deterministic macronutrient gram and calorie targets.
 *
 * Energetic Densities (Atwater General Factors):
 * - Protein yields 4 kcal/gram.
 * - Carbohydrates yield 4 kcal/gram.
 * - Fat yields 9 kcal/gram.
 *
 * Fiber Reference Guideline:
 * - Reference guideline derived from the Institute of Medicine (IOM) Dietary Reference
 *   Intakes and Dietary Guidelines for Americans: 14g fiber per 1,000 kcal.
 * - This baseline is an unprescriptive public health reference guideline, not an individual
 *   medical or clinical prescription.
 * - No artificial minimum floor (e.g. 15g) is imposed; low-calorie and high-calorie targets
 *   scale proportionally. Configurable via `customFiberGrams`.
 *
 * Custom Macro Energy Consistency Policy:
 * - Macro-derived energy is explicitly calculated using Atwater factors: (P * 4 + C * 4 + F * 9).
 * - Both `dailyCalories` (user's budget target) and `macroDerivedCalories` (sum of macro energy)
 *   are preserved transparently in the returned model.
 * - Macro grams and calorie targets are NEVER silently altered.
 * - If macro energy deviates from the daily calorie target beyond the documented consistency threshold
 *   (> 5.0% variance and > 100 kcal difference), `isEnergyConsistent` is flagged as false and an
 *   informative warning is populated.
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
    customFiberGrams,
  } = input;

  if (!Number.isFinite(dailyCalories) || dailyCalories <= 0) {
    throw new DomainValidationError(
      `Daily calories must be a positive finite number (received: ${dailyCalories}).`,
    );
  }

  // Validate custom fiber if provided
  if (customFiberGrams !== undefined) {
    if (!Number.isFinite(customFiberGrams) || customFiberGrams < 0) {
      throw new DomainValidationError(
        `Custom fiber grams must be a non-negative finite number (received: ${customFiberGrams}).`,
      );
    }
  }

  // Resolve fiber target: custom override if present, else 14g / 1000 kcal reference guideline
  const fiberGrams =
    customFiberGrams !== undefined
      ? roundTo(customFiberGrams, 1)
      : roundTo((dailyCalories / 1000) * FIBER_GRAMS_PER_1000_KCAL, 1);

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
    const macroDerivedCalories = proteinCalories + carbsCalories + fatCalories;

    const proteinPct =
      macroDerivedCalories > 0 ? roundTo(proteinCalories / macroDerivedCalories, 3) : 0;
    const carbsPct =
      macroDerivedCalories > 0 ? roundTo(carbsCalories / macroDerivedCalories, 3) : 0;
    const fatPct = macroDerivedCalories > 0 ? roundTo(fatCalories / macroDerivedCalories, 3) : 0;

    const calorieDelta = macroDerivedCalories - dailyCalories;
    const rawVariancePct = dailyCalories > 0 ? (Math.abs(calorieDelta) / dailyCalories) * 100 : 0;
    const isEnergyConsistent =
      Math.abs(calorieDelta) <= MACRO_ENERGY_CONSISTENCY_ABSOLUTE_KCAL ||
      rawVariancePct <= MACRO_ENERGY_CONSISTENCY_TOLERANCE_PCT;
    const calorieVariancePercentage = roundTo(rawVariancePct, 1);

    const warnings: string[] = [];
    if (!isEnergyConsistent) {
      warnings.push(
        `Custom macronutrient amounts yield ${macroDerivedCalories} kcal (${proteinCalories}P + ${carbsCalories}C + ${fatCalories}F), which deviates from your requested daily target of ${dailyCalories} kcal by ${calorieDelta > 0 ? '+' : ''}${calorieDelta} kcal (${calorieVariancePercentage}%).`,
      );
    }

    return {
      dailyCalories,
      macroDerivedCalories,
      calorieDelta,
      calorieVariancePercentage,
      isEnergyConsistent,
      warnings,
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
  if (Math.abs(sumOfPercentages - 1.0) > MACRO_PERCENTAGE_TOLERANCE) {
    throw new DomainValidationError(
      `Macronutrient percentages must sum to 100% (1.0). Current sum: ${roundTo(sumOfPercentages * 100, 2)}% (tolerance: ${MACRO_PERCENTAGE_TOLERANCE * 100}%).`,
    );
  }

  const proteinCalories = roundTo(dailyCalories * proteinPercentage, 0);
  const carbsCalories = roundTo(dailyCalories * carbsPercentage, 0);
  const fatCalories = roundTo(dailyCalories * fatPercentage, 0);
  const macroDerivedCalories = proteinCalories + carbsCalories + fatCalories;

  const proteinGrams = roundTo(proteinCalories / ATWATER_FACTORS.PROTEIN, 1);
  const carbsGrams = roundTo(carbsCalories / ATWATER_FACTORS.CARBOHYDRATE, 1);
  const fatGrams = roundTo(fatCalories / ATWATER_FACTORS.FAT, 1);

  const calorieDelta = macroDerivedCalories - dailyCalories;
  const rawVariancePct = dailyCalories > 0 ? (Math.abs(calorieDelta) / dailyCalories) * 100 : 0;
  const calorieVariancePercentage = roundTo(rawVariancePct, 1);
  const isEnergyConsistent = true; // In percentage distribution, calories are directly scaled from dailyCalories

  return {
    dailyCalories,
    macroDerivedCalories,
    calorieDelta,
    calorieVariancePercentage,
    isEnergyConsistent,
    warnings: [],
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
