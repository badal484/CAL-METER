import { BiologicalSex, Gender } from '../constants/enums.js';
import { BmrCalculationInput, BmrCalculationResult } from '../types/index.js';
import { roundTo } from '../utils/measurements.js';

/**
 * Calculates Basal Metabolic Rate (BMR) using the clinically validated
 * Mifflin-St Jeor equation (1990).
 *
 * Health & Safety Rules:
 * 1. The equation is validated strictly for adults aged 18 and older. Minors are
 *    an unsupported population; pediatric growth equations and clinical guidance are required.
 * 2. Pregnancy and lactation drastically alter basal metabolic requirements and are not
 *    supported by non-pregnant adult predictive models.
 * 3. BMR is an estimate of basal resting expenditure, not a clinical prescription.
 */
export function calculateBmr(input: BmrCalculationInput): BmrCalculationResult {
  const { weightKg, heightCm, ageYears, biologicalSex, gender, isPregnant, isLactating } = input;

  // Rule 1: Minors safety restriction
  if (ageYears < 18) {
    return {
      status: 'UNSUPPORTED',
      reason: 'MINORS_NOT_SUPPORTED',
      message:
        'The Mifflin-St Jeor equation is not clinically validated for individuals under 18 years of age. Pediatric nutrition requires specialized growth charts and clinical oversight.',
    };
  }

  // Rule 2: Pregnancy and lactation safety restriction
  if (isPregnant || isLactating) {
    return {
      status: 'UNSUPPORTED',
      reason: 'PREGNANCY_LACTATION_NOT_SUPPORTED',
      message:
        'Standard adult resting energy expenditure equations do not account for gestational or lactational metabolic demands. Please consult a maternal healthcare professional.',
    };
  }

  // Rule 3: Physiological biometric bounds checking
  if (weightKg < 30 || weightKg > 350 || heightCm < 100 || heightCm > 250 || ageYears > 120) {
    return {
      status: 'UNSUPPORTED',
      reason: 'OUT_OF_BOUNDS_BIOMETRICS',
      message:
        'Supplied biometrics fall outside validated physiological boundaries (Weight: 30-350 kg, Height: 100-250 cm, Age: 18-120 years).',
    };
  }

  // Determine calculation sex
  // 10 * weight (kg) + 6.25 * height (cm) - 5 * age (y) + s
  // s = +5 for male, -161 for female, -78 for other/unspecified (average of male and female)
  let sexOffset = -78; // Default midpoint
  let sexDetermined = false;

  if (biologicalSex === BiologicalSex.MALE || gender === Gender.MALE) {
    sexOffset = 5;
    sexDetermined = true;
  } else if (biologicalSex === BiologicalSex.FEMALE || gender === Gender.FEMALE) {
    sexOffset = -161;
    sexDetermined = true;
  }

  const baseBmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexOffset;
  const roundedBmr = roundTo(baseBmr, 0);

  const disclaimers: string[] = [
    'BMR is a statistical resting estimate derived from the Mifflin-St Jeor equation (1990) and carries a standard estimation variance of ±10%.',
    'Actual metabolic expenditure varies with lean body mass, genetics, thyroid function, and environmental temperature.',
  ];

  if (!sexDetermined) {
    disclaimers.push(
      'Biological sex was not specified; BMR was calculated using the population median between male and female equations.',
    );
  }

  return {
    status: 'SUCCESS',
    bmr: roundedBmr,
    formula: 'Mifflin-St Jeor (1990)',
    disclaimers,
  };
}
