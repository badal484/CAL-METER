import { PrimaryGoal } from './enums.js';

/**
 * Atwater general factors for caloric density per gram.
 * Protein: 4 kcal/g, Carbohydrates: 4 kcal/g, Fat: 9 kcal/g, Alcohol: 7 kcal/g.
 */
export const ATWATER_FACTORS = {
  PROTEIN: 4,
  CARBOHYDRATE: 4,
  FAT: 9,
  ALCOHOL: 7,
} as const;

export interface MacroDistribution {
  proteinPercentage: number;
  carbsPercentage: number;
  fatPercentage: number;
}

/**
 * Default macronutrient distribution templates by primary goal.
 * Values are fractions totaling 1.0 (100%).
 * These are initial suggestions and should be fully configurable by the user.
 */
export const DEFAULT_MACRO_DISTRIBUTIONS: Record<PrimaryGoal, MacroDistribution> = {
  [PrimaryGoal.LOSE_WEIGHT]: {
    proteinPercentage: 0.3,
    carbsPercentage: 0.4,
    fatPercentage: 0.3,
  },
  [PrimaryGoal.MAINTAIN_WEIGHT]: {
    proteinPercentage: 0.25,
    carbsPercentage: 0.5,
    fatPercentage: 0.25,
  },
  [PrimaryGoal.BUILD_MUSCLE]: {
    proteinPercentage: 0.3,
    carbsPercentage: 0.5,
    fatPercentage: 0.2,
  },
} as const;

/**
 * Dietary Reference Intake (DRI) recommended fiber baseline per 1,000 kcal.
 * Guideline derived from the Institute of Medicine (IOM) / Dietary Guidelines for Americans
 * (14g fiber per 1,000 kcal). This is a public health reference guideline, not an individual
 * clinical prescription.
 */
export const FIBER_GRAMS_PER_1000_KCAL = 14;

/**
 * Tolerance for macro percentage validation (floating-point input).
 * Exactly 0.001 (0.1%) variance from 1.0 (100%) to accommodate standard
 * three-way splits such as 33.3% / 33.3% / 33.4% or minor client rounding.
 */
export const MACRO_PERCENTAGE_TOLERANCE = 0.001;

/**
 * Energy consistency tolerance threshold between macro-derived energy (Atwater factors)
 * and nominal daily calorie target.
 * Allowance: 5.0% variance or up to 100 kcal absolute difference.
 */
export const MACRO_ENERGY_CONSISTENCY_TOLERANCE_PCT = 5.0;
export const MACRO_ENERGY_CONSISTENCY_ABSOLUTE_KCAL = 100;
