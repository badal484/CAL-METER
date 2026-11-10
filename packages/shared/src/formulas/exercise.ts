import { ExerciseCategory, ExerciseIntensity, CalorieEstimateSource } from '../constants/enums.js';
import { DomainValidationError } from '../errors/index.js';
import { roundTo } from '../utils/measurements.js';

export interface ExerciseCalorieInput {
  category: ExerciseCategory;
  durationMinutes: number;
  weightKg: number;
  intensity?: ExerciseIntensity;
  customMet?: number;
}

export interface ExerciseCalorieResult {
  caloriesBurned: number;
  metValue: number;
  formula: string;
  source: CalorieEstimateSource;
  notes: string[];
  disclaimers: string[];
}

/**
 * Standard Metabolic Equivalent of Task (MET) reference values
 * derived from the 2011/2024 Compendium of Physical Activities.
 * 1 MET = 1.0 kcal/kg/hour resting metabolic rate equivalent.
 */
export const DEFAULT_MET_VALUES: Record<ExerciseCategory, Record<ExerciseIntensity, number>> = {
  [ExerciseCategory.WALKING]: {
    [ExerciseIntensity.LIGHT]: 2.8, // Slow stroll, < 3.5 km/h
    [ExerciseIntensity.MODERATE]: 3.5, // Brisk walking, ~4.5 - 5.0 km/h
    [ExerciseIntensity.VIGOROUS]: 5.0, // Very brisk / incline walking, > 6.0 km/h
  },
  [ExerciseCategory.RUNNING]: {
    [ExerciseIntensity.LIGHT]: 7.0, // Jogging, ~8 km/h / 5 mph
    [ExerciseIntensity.MODERATE]: 9.8, // Running, ~10 km/h / 6 mph
    [ExerciseIntensity.VIGOROUS]: 12.0, // Fast run / intervals, > 12 km/h / 7.5 mph
  },
  [ExerciseCategory.CYCLING]: {
    [ExerciseIntensity.LIGHT]: 4.0, // Leisurely cycling, < 15 km/h
    [ExerciseIntensity.MODERATE]: 6.8, // Moderate road/stationary cycling, 16-19 km/h
    [ExerciseIntensity.VIGOROUS]: 10.0, // Fast cycling / intense spin class, > 20 km/h
  },
  [ExerciseCategory.SWIMMING]: {
    [ExerciseIntensity.LIGHT]: 5.0, // Casual swimming, leisurely laps
    [ExerciseIntensity.MODERATE]: 7.0, // Freestyle or breaststroke laps, moderate effort
    [ExerciseIntensity.VIGOROUS]: 10.0, // Fast laps, butterfly, competitive pace
  },
  [ExerciseCategory.GYM_WORKOUT]: {
    [ExerciseIntensity.LIGHT]: 3.5, // Light conditioning, mobility, warmups
    [ExerciseIntensity.MODERATE]: 5.5, // Circuit training, moderate conditioning
    [ExerciseIntensity.VIGOROUS]: 8.0, // HIIT, CrossFit, intense functional intervals
  },
  [ExerciseCategory.STRENGTH_TRAINING]: {
    [ExerciseIntensity.LIGHT]: 3.0, // Light resistance, machine exercises with long rest
    [ExerciseIntensity.MODERATE]: 4.5, // Standard hypertrophy, free weights (8-12 reps)
    [ExerciseIntensity.VIGOROUS]: 6.0, // Heavy compound lifting (deadlift/squats), minimal rest
  },
  [ExerciseCategory.YOGA]: {
    [ExerciseIntensity.LIGHT]: 2.5, // Hatha, restorative or gentle stretch yoga
    [ExerciseIntensity.MODERATE]: 3.5, // Vinyasa flow, power yoga
    [ExerciseIntensity.VIGOROUS]: 4.5, // Ashtanga, Bikram / hot yoga
  },
  [ExerciseCategory.SPORTS]: {
    [ExerciseIntensity.LIGHT]: 4.0, // Table tennis, casual badminton
    [ExerciseIntensity.MODERATE]: 7.0, // Tennis singles, basketball recreational, cricket
    [ExerciseIntensity.VIGOROUS]: 9.5, // Competitive football/soccer, squash, rugby
  },
  [ExerciseCategory.OTHER]: {
    [ExerciseIntensity.LIGHT]: 3.0,
    [ExerciseIntensity.MODERATE]: 5.0,
    [ExerciseIntensity.VIGOROUS]: 7.5,
  },
};

/**
 * Calculates estimated exercise energy expenditure using the clinically standard
 * Metabolic Equivalent of Task (MET) formula:
 *
 * Energy (kcal) = MET × body_weight (kg) × duration (hours)
 *
 * Safety & Quality Guardrails:
 * 1. Enforces realistic duration bounds (1 to 1,440 minutes).
 * 2. Enforces realistic weight bounds (30 to 350 kg).
 * 3. Transparently communicates that values are statistical estimates, not direct calorimetry.
 * 4. Strictly advises that exercise calories are NOT automatically credited to food calorie allowances.
 */
export function calculateExerciseCalories(input: ExerciseCalorieInput): ExerciseCalorieResult {
  const {
    category,
    durationMinutes,
    weightKg,
    intensity = ExerciseIntensity.MODERATE,
    customMet,
  } = input;

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
    throw new DomainValidationError(
      `Exercise duration must be a positive number between 1 and 1,440 minutes (received: ${durationMinutes}).`,
    );
  }

  if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 350) {
    throw new DomainValidationError(
      `User weight must be a realistic value between 30 kg and 350 kg for exercise estimation (received: ${weightKg}).`,
    );
  }

  let metValue: number;
  let source: CalorieEstimateSource;
  const notes: string[] = [];

  if (customMet !== undefined) {
    if (!Number.isFinite(customMet) || customMet <= 0 || customMet > 30) {
      throw new DomainValidationError(
        `Custom MET value must be a positive number between 0.5 and 30 (received: ${customMet}).`,
      );
    }
    metValue = customMet;
    source = CalorieEstimateSource.MANUAL_ENTRY;
    notes.push(`Used user-specified custom MET value of ${metValue}.`);
  } else {
    const categoryMets = DEFAULT_MET_VALUES[category] || DEFAULT_MET_VALUES[ExerciseCategory.OTHER];
    metValue = categoryMets[intensity] || categoryMets[ExerciseIntensity.MODERATE];
    source = CalorieEstimateSource.MET_FORMULA;
    notes.push(
      `Estimated using standard Compendium MET value of ${metValue} for ${category} at ${intensity} intensity.`,
    );
  }

  // Energy Expenditure Formula: MET * weightKg * (durationMinutes / 60)
  const durationHours = durationMinutes / 60;
  const rawCalories = metValue * weightKg * durationHours;
  const roundedCalories = roundTo(rawCalories, 1);

  const disclaimers: string[] = [
    'Exercise energy expenditure is a mathematical estimate based on population MET averages, not direct metabolic measurement.',
    'Actual energy burned varies significantly with muscle mass, fitness level, technique, and ambient conditions.',
    'Exercise calories are tracked for physical activity trends and are NOT automatically added to your daily food calorie budget.',
  ];

  return {
    caloriesBurned: roundedCalories,
    metValue,
    formula: 'MET × weight (kg) × (duration / 60)',
    source,
    notes,
    disclaimers,
  };
}
