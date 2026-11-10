import { PrimaryGoal } from '../constants/enums.js';
import { DomainValidationError } from '../errors/index.js';
import { CalorieTargetInput, CalorieTargetResult } from '../types/index.js';
import { roundTo } from '../utils/measurements.js';

/**
 * Energy equivalence factor: approximately 7,700 kcal represents 1 kg of human tissue mass.
 */
const KCAL_PER_KG_WEIGHT_CHANGE = 7700;

/**
 * Calculates personalized daily calorie intake targets based on energy balance principles.
 *
 * Health & Safety Guidelines:
 * 1. No universal arbitrary calorie floor is enforced; safety is evaluated dynamically
 *    relative to the user's specific TDEE and BMR.
 * 2. Aggressive deficits (>25% below TDEE or >1.0 kg/week) are explicitly flagged with safety warnings.
 * 3. Targets falling below BMR are accompanied by nutritional guidance warnings.
 * 4. User overrides are fully supported to ensure agency and configurability.
 */
export function calculateCalorieTarget(input: CalorieTargetInput): CalorieTargetResult {
  const { tdee, bmr, primaryGoal, paceKgPerWeek = 0.5, customCalorieOverride } = input;

  if (tdee <= 0 || bmr <= 0) {
    throw new DomainValidationError('TDEE and BMR must be positive non-zero numbers.');
  }

  // Handle manual user override
  if (customCalorieOverride !== undefined) {
    if (customCalorieOverride < 500 || customCalorieOverride > 8000) {
      throw new DomainValidationError(
        `Custom calorie override (${customCalorieOverride} kcal) is outside plausible safety boundaries (500-8,000 kcal).`,
      );
    }

    const dailyDelta = customCalorieOverride - tdee;
    const impliedPace = roundTo((Math.abs(dailyDelta) * 7) / KCAL_PER_KG_WEIGHT_CHANGE, 2);
    const deficitPct = dailyDelta < 0 ? roundTo((Math.abs(dailyDelta) / tdee) * 100, 1) : 0;
    const isBelowBmr = customCalorieOverride < bmr;

    const warnings: string[] = [];
    if (deficitPct > 25) {
      warnings.push(
        `Selected calorie target implies an aggressive deficit of ${deficitPct}% below your TDEE.`,
      );
    }
    if (isBelowBmr) {
      warnings.push(
        'Your selected target is below your estimated Basal Metabolic Rate (BMR). Sustained intake below BMR may increase fatigue and lean muscle loss.',
      );
    }

    return {
      dailyCalories: customCalorieOverride,
      tdee,
      bmr,
      primaryGoal,
      dailyDeficitOrSurplus: dailyDelta,
      paceKgPerWeek: impliedPace,
      deficitPercentageOfTdee: deficitPct,
      isBelowBmr,
      warnings,
      disclaimers: [
        'User custom calorie override is active.',
        'Calorie targets are adjustable at any time based on real-world weight trends.',
      ],
    };
  }

  // Automated goal-based calculations
  let dailyDelta = 0;
  let effectivePace = paceKgPerWeek;
  const warnings: string[] = [];

  switch (primaryGoal) {
    case PrimaryGoal.LOSE_WEIGHT: {
      // Validate pace
      if (effectivePace <= 0) {
        effectivePace = 0.5; // Default healthy pace
      }
      if (effectivePace > 1.0) {
        warnings.push(
          `A weight loss pace of ${effectivePace} kg/week is considered aggressive. Clinical guidelines recommend 0.25 to 1.0 kg/week for sustainable fat loss.`,
        );
      }

      // Daily deficit = (pace * 7700) / 7 = pace * 1100
      const calculatedDeficit = (effectivePace * KCAL_PER_KG_WEIGHT_CHANGE) / 7;
      dailyDelta = -roundTo(calculatedDeficit, 0);
      break;
    }

    case PrimaryGoal.BUILD_MUSCLE: {
      // Moderate hyperenergetic surplus (typically 5% - 15% of TDEE or ~250-400 kcal)
      const surplus = Math.min(Math.max(roundTo(tdee * 0.1, 0), 200), 500);
      dailyDelta = surplus;
      effectivePace = roundTo((dailyDelta * 7) / KCAL_PER_KG_WEIGHT_CHANGE, 2);
      break;
    }

    case PrimaryGoal.MAINTAIN_WEIGHT:
    default: {
      dailyDelta = 0;
      effectivePace = 0;
      break;
    }
  }

  const rawTarget = tdee + dailyDelta;
  const dailyCalories = Math.max(roundTo(rawTarget, 0), 800); // Safety floor to prevent negative or zero calculation
  const deficitPct = dailyDelta < 0 ? roundTo((Math.abs(dailyDelta) / tdee) * 100, 1) : 0;
  const isBelowBmr = dailyCalories < bmr;

  if (deficitPct > 25) {
    warnings.push(
      `Calculated daily deficit (${deficitPct}%) exceeds 25% of TDEE. Consider reducing your target pace for greater adherence.`,
    );
  }

  if (isBelowBmr) {
    warnings.push(
      'Target calorie intake is below your estimated resting BMR. Monitor your energy, performance, and recovery closely.',
    );
  }

  return {
    dailyCalories,
    tdee,
    bmr,
    primaryGoal,
    dailyDeficitOrSurplus: dailyDelta,
    paceKgPerWeek: effectivePace,
    deficitPercentageOfTdee: deficitPct,
    isBelowBmr,
    warnings,
    disclaimers: [
      'Calorie target is a guideline based on estimated energy balance.',
      'Adjust targets every 2-4 weeks based on your actual scale weight trajectory.',
    ],
  };
}
