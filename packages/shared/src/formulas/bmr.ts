import { BiologicalSex, Gender } from '../constants/enums.js';
import { BmrCalculationInput, BmrCalculationResult, BmrCalculationMethod } from '../types/index.js';
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
 * 4. Biological sex is required for physiological accuracy. Biological sex is NOT inferred
 *    from gender identity. When biological sex is omitted, an explicit unvalidated mathematical
 *    midpoint is applied with transparent disclosure.
 */
export function calculateBmr(input: BmrCalculationInput): BmrCalculationResult {
  const { weightKg, heightCm, ageYears, biologicalSex, gender, isPregnant, isLactating } = input;

  // Rule 1: Validate numeric finiteness and positivity
  if (
    !Number.isFinite(weightKg) ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(ageYears) ||
    weightKg <= 0 ||
    heightCm <= 0 ||
    ageYears <= 0
  ) {
    return {
      status: 'UNSUPPORTED',
      reason: 'INVALID_BIOMETRICS',
      message: 'Biometric values (weight, height, age) must be finite positive numbers.',
    };
  }

  // Rule 2: Minors safety restriction
  if (ageYears < 18) {
    return {
      status: 'UNSUPPORTED',
      reason: 'MINORS_NOT_SUPPORTED',
      message:
        'The Mifflin-St Jeor equation is not clinically validated for individuals under 18 years of age. Pediatric nutrition requires specialized growth charts and clinical oversight.',
    };
  }

  // Rule 3: Pregnancy and lactation safety restriction
  if (isPregnant || isLactating) {
    return {
      status: 'UNSUPPORTED',
      reason: 'PREGNANCY_LACTATION_NOT_SUPPORTED',
      message:
        'Standard adult resting energy expenditure equations do not account for gestational or lactational metabolic demands. Please consult a maternal healthcare professional.',
    };
  }

  // Rule 4: Physiological biometric bounds checking
  if (weightKg < 30 || weightKg > 350 || heightCm < 100 || heightCm > 250 || ageYears > 120) {
    return {
      status: 'UNSUPPORTED',
      reason: 'OUT_OF_BOUNDS_BIOMETRICS',
      message:
        'Supplied biometrics fall outside validated physiological boundaries (Weight: 30-350 kg, Height: 100-250 cm, Age: 18-120 years).',
    };
  }

  // Determine calculation sex and handle biological sex vs gender explicitly
  let sexOffset: number;
  let calculationMethod: BmrCalculationMethod;
  const notes: string[] = [];

  if (biologicalSex === BiologicalSex.MALE) {
    sexOffset = 5;
    calculationMethod = 'MIFFLIN_ST_JEOR_MALE';
    if (gender && gender !== Gender.MALE) {
      notes.push(
        `Calculated using biologicalSex (${biologicalSex}) for physiological accuracy. Note: Gender identity (${gender}) differs from biological sex; clinical predictive equations are derived from biological sex assigned at birth.`,
      );
    }
  } else if (biologicalSex === BiologicalSex.FEMALE) {
    sexOffset = -161;
    calculationMethod = 'MIFFLIN_ST_JEOR_FEMALE';
    if (gender && gender !== Gender.FEMALE) {
      notes.push(
        `Calculated using biologicalSex (${biologicalSex}) for physiological accuracy. Note: Gender identity (${gender}) differs from biological sex; clinical predictive equations are derived from biological sex assigned at birth.`,
      );
    }
  } else {
    // Biological sex is not supplied.
    // Crucial rule: Do NOT infer biological sex from gender identity.
    sexOffset = -78;
    calculationMethod = 'UNVALIDATED_SEX_AVERAGE';
    notes.push(
      'Biological sex was not specified. The resulting estimate uses a mathematical midpoint average between the male (+5) and female (-161) Mifflin-St Jeor equations (-78 offset). This midpoint is NOT a clinically validated standalone equation and carries higher estimation variance.',
    );
    if (gender) {
      notes.push(
        `Gender identity (${gender}) was provided, but biological sex was omitted. Predictive equations are not inferred from gender identity.`,
      );
    }
  }

  // Base equation: 10 * weight (kg) + 6.25 * height (cm) - 5 * age (y) + s
  const baseBmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexOffset;
  const roundedBmr = roundTo(baseBmr, 0);

  const disclaimers: string[] = [
    'BMR is a statistical resting estimate derived from the Mifflin-St Jeor equation (1990) and carries a standard estimation variance of ±10%.',
    'Actual metabolic expenditure varies with lean body mass, genetics, thyroid function, and environmental temperature.',
  ];

  return {
    status: 'SUCCESS',
    bmr: roundedBmr,
    formula: 'Mifflin-St Jeor (1990)',
    calculationMethod,
    notes,
    disclaimers,
  };
}
