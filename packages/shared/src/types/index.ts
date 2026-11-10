import {
  BiologicalSex,
  Gender,
  ActivityLevel,
  PrimaryGoal,
  ServingProvenance,
} from '../constants/enums.js';

export interface NutrientProfile {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams?: number;
  micronutrients?: Record<string, number>;
}

export interface BmrCalculationInput {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  biologicalSex?: BiologicalSex;
  gender?: Gender;
  isPregnant?: boolean;
  isLactating?: boolean;
}

export type BmrCalculationMethod =
  'MIFFLIN_ST_JEOR_MALE' | 'MIFFLIN_ST_JEOR_FEMALE' | 'UNVALIDATED_SEX_AVERAGE';

export type BmrCalculationResult =
  | {
      status: 'SUCCESS';
      bmr: number;
      formula: 'Mifflin-St Jeor (1990)';
      calculationMethod: BmrCalculationMethod;
      notes: string[];
      disclaimers: string[];
    }
  | {
      status: 'UNSUPPORTED';
      reason:
        | 'MINORS_NOT_SUPPORTED'
        | 'PREGNANCY_LACTATION_NOT_SUPPORTED'
        | 'OUT_OF_BOUNDS_BIOMETRICS'
        | 'INVALID_BIOMETRICS';
      message: string;
    };

export interface TdeeCalculationInput {
  bmr: number;
  activityLevel: ActivityLevel;
}

export interface TdeeCalculationResult {
  tdee: number;
  bmr: number;
  activityMultiplier: number;
  activityLevel: ActivityLevel;
  disclaimers: string[];
}

export interface CalorieTargetInput {
  tdee: number;
  bmr: number;
  primaryGoal: PrimaryGoal;
  paceKgPerWeek?: number; // e.g. 0.25 to 1.0 kg/week for fat loss
  customCalorieOverride?: number;
}

export interface CalorieTargetResult {
  dailyCalories: number;
  tdee: number;
  bmr: number;
  primaryGoal: PrimaryGoal;
  dailyDeficitOrSurplus: number;
  paceKgPerWeek: number;
  deficitPercentageOfTdee: number;
  isBelowBmr: boolean;
  warnings: string[];
  disclaimers: string[];
}

export interface MacroCalculationInput {
  dailyCalories: number;
  proteinPercentage?: number;
  carbsPercentage?: number;
  fatPercentage?: number;
  customProteinGrams?: number;
  customCarbsGrams?: number;
  customFatGrams?: number;
  customFiberGrams?: number;
}

export interface MacroTargetResult {
  dailyCalories: number; // Requested daily calorie target
  macroDerivedCalories: number; // Exact energy calculated from macronutrients via Atwater factors (4/4/9)
  calorieDelta: number; // macroDerivedCalories - dailyCalories
  calorieVariancePercentage: number; // |calorieDelta| / dailyCalories * 100
  isEnergyConsistent: boolean; // true if within documented energy tolerance threshold
  warnings: string[]; // explicit warnings if macro energy deviates from requested calorie target
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  proteinCalories: number;
  carbsCalories: number;
  fatCalories: number;
  proteinPercentage: number;
  carbsPercentage: number;
  fatPercentage: number;
}

export interface FoodServingConversion {
  foodId?: string;
  foodName?: string;
  unit: string; // e.g. 'katori', 'roti', 'bowl', 'ladle', 'glass', 'piece', 'cup', 'tbsp', 'tsp'
  gramWeight: number; // Food-specific weight in grams for this serving unit
  volumeMl?: number;
  provenance: ServingProvenance;
  notes?: string;
}

export type ServingConversionResult =
  | {
      success: true;
      gramWeight: number;
      unit: string;
      quantity: number;
      provenance: ServingProvenance;
      notes?: string;
    }
  | {
      success: false;
      error:
        | 'UNSUPPORTED_UNIT_FOR_FOOD'
        | 'INVALID_QUANTITY'
        | 'INVALID_CONVERSION_FACTOR'
        | 'CONVERSION_OVERFLOW'
        | 'MISSING_FOOD_CONVERSION';
      message: string;
    };
