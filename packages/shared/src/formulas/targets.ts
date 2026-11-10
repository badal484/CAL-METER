import { PrimaryGoal } from '../constants/enums.js';
import { DomainValidationError } from '../errors/index.js';
import { CalorieTargetInput, CalorieTargetResult } from '../types/index.js';
import { roundTo } from '../utils/measurements.js';

/**
 * Energy equivalence factor: approximately 7,700 kcal represents 1 kg of human tissue mass.
 *
 * Scientific Limitation Disclaimer:
 * The 7,700 kcal/kg (approx. 3,500 kcal/lb) conversion assumes weight lost is purely adipose tissue
 * with constant energy expenditure. In living human physiology, energy expenditure adapts dynamically
 * (metabolic adaptation / adaptive thermogenesis), and weight changes involve fluctuating ratios of
 * glycogen, water, and lean mass. This static model is an estimation tool, not a dynamic medical simulation.
 */
const KCAL_PER_KG_WEIGHT_CHANGE = 7700;

/**
 * Calculates personalized daily calorie intake targets based on energy balance principles.
 *
 * Health & Safety Guidelines:
 * 1. No arbitrary universal calorie floors (e.g. 800 or 1200 kcal) are enforced.
 *    Safety is evaluated dynamically and transparently relative to the user's specific TDEE and BMR.
 * 2. Inputs are strictly validated to be finite positive numbers.
 * 3. User-requested paces are never silently altered or clamped.
 * 4. Aggressive deficits (>25% below TDEE or >1.0 kg/week) and targets below BMR or <= 0
 *    are explicitly flagged with clear safety warnings.
 * 5. Calculations are clearly marked as mathematical approximations, not medical prescriptions.
 */
export function calculateCalorieTarget(input: CalorieTargetInput): CalorieTargetResult {
  const { tdee, bmr, primaryGoal, paceKgPerWeek, customCalorieOverride } = input;

  // Validate finite and physiologically plausible inputs
  if (!Number.isFinite(tdee) || tdee <= 0) {
    throw new DomainValidationError(`TDEE must be a positive finite number (received: ${tdee}).`);
  }

  if (!Number.isFinite(bmr) || bmr <= 0) {
    throw new DomainValidationError(`BMR must be a positive finite number (received: ${bmr}).`);
  }

  const disclaimers: string[] = [
    'Mathematically calculated calorie targets are energy balance approximations, not medical prescriptions or clinical dietary treatments.',
    'The 7,700 kcal/kg rule is a static model; real-world energy expenditure adapts dynamically as body mass and activity change.',
    'Adjust targets every 2-4 weeks based on your actual scale weight trajectory and physical recovery.',
  ];

  // Handle manual user override
  if (customCalorieOverride !== undefined) {
    if (!Number.isFinite(customCalorieOverride) || customCalorieOverride <= 0) {
      throw new DomainValidationError(
        `Custom calorie override must be a positive finite number (received: ${customCalorieOverride}).`,
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
        `Your selected target (${customCalorieOverride} kcal) is below your estimated resting BMR (${bmr} kcal). Sustained intake below BMR may increase fatigue and lean muscle loss.`,
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
      disclaimers: ['User custom calorie override is active.', ...disclaimers],
    };
  }

  // Automated goal-based calculations
  let dailyDelta = 0;
  let effectivePace = paceKgPerWeek ?? 0.5;
  const warnings: string[] = [];

  switch (primaryGoal) {
    case PrimaryGoal.LOSE_WEIGHT: {
      if (!Number.isFinite(effectivePace) || effectivePace <= 0) {
        throw new DomainValidationError(
          `Weight loss pace must be a positive finite number in kg/week (received: ${effectivePace}).`,
        );
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
      // Moderate hyperenergetic surplus: 10% of TDEE (bounded between 200 and 500 kcal)
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

  // Calculate target transparently without arbitrary floors
  const dailyCalories = roundTo(tdee + dailyDelta, 0);
  const deficitPct = dailyDelta < 0 ? roundTo((Math.abs(dailyDelta) / tdee) * 100, 1) : 0;
  const isBelowBmr = dailyCalories < bmr;

  if (dailyCalories <= 0) {
    warnings.push(
      `Calculated calorie target is non-viable (${dailyCalories} kcal). The requested pace of ${effectivePace} kg/week produces a daily deficit (${Math.abs(dailyDelta)} kcal) exceeding your entire daily energy expenditure (${tdee} kcal).`,
    );
  } else {
    if (deficitPct > 25) {
      warnings.push(
        `Calculated daily deficit (${deficitPct}%) exceeds 25% of TDEE. Consider reducing your target pace for sustainable adherence.`,
      );
    }
    if (isBelowBmr) {
      warnings.push(
        `Target calorie intake (${dailyCalories} kcal) is below your estimated resting BMR (${bmr} kcal). Monitor your energy, recovery, and lean mass closely.`,
      );
    }
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
    disclaimers,
  };
}
