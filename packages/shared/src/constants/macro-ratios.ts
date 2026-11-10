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
 */
export const FIBER_GRAMS_PER_1000_KCAL = 14;
