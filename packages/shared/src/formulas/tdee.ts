import { ACTIVITY_MULTIPLIERS } from '../constants/activity-multipliers.js';
import { DomainValidationError } from '../errors/index.js';
import { TdeeCalculationInput, TdeeCalculationResult } from '../types/index.js';
import { roundTo } from '../utils/measurements.js';

/**
 * Estimates Total Daily Energy Expenditure (TDEE) by multiplying BMR
 * by documented Physical Activity Level (PAL) coefficients.
 */
export function calculateTdee(input: TdeeCalculationInput): TdeeCalculationResult {
  const { bmr, activityLevel } = input;

  if (bmr < 500 || bmr > 5000) {
    throw new DomainValidationError(
      `BMR value ${bmr} kcal is outside plausible physiological limits.`,
    );
  }

  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  if (!multiplier) {
    throw new DomainValidationError(`Unsupported or invalid activity level: ${activityLevel}`);
  }

  const tdee = roundTo(bmr * multiplier, 0);

  return {
    tdee,
    bmr,
    activityMultiplier: multiplier,
    activityLevel,
    disclaimers: [
      'TDEE is a mathematical estimation based on population-level activity multipliers.',
      'Daily variance is expected due to fluctuations in Non-Exercise Activity Thermogenesis (NEAT) and formal exercise.',
    ],
  };
}
