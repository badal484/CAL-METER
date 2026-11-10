import {
  BiologicalSex,
  Gender,
  ActivityLevel,
  PrimaryGoal,
  DietPreference,
  UnitSystem,
} from '@calmeter/shared';

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface OnboardingFormState {
  name: string;
  dob: string;
  biologicalSex: BiologicalSex;
  gender: Gender;
  unitSystem: UnitSystem;
  heightCm: number;
  heightFeet: number;
  heightInches: number;
  currentWeightKg: number;
  currentWeightLbs: number;
  targetWeightKg: number;
  targetWeightLbs: number;
  primaryGoal: PrimaryGoal;
  activityLevel: ActivityLevel;
  paceKgPerWeek: number;
  dietPreference: DietPreference;
  // Optional customizations
  customDailyCalories?: number;
  customProteinGrams?: number;
  customCarbsGrams?: number;
  customFatGrams?: number;
  customFiberGrams?: number;
}
