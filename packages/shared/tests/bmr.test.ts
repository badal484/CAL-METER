import { describe, it, expect } from 'vitest';
import { calculateBmr } from '../src/formulas/bmr.js';
import { BiologicalSex, Gender } from '../src/constants/enums.js';

describe('BMR Calculation (Mifflin-St Jeor)', () => {
  it('correctly calculates BMR for a standard adult male', () => {
    // 80 kg, 180 cm, 30 years old male
    // BMR = 10(80) + 6.25(180) - 5(30) + 5 = 800 + 1125 - 150 + 5 = 1780 kcal
    const result = calculateBmr({
      weightKg: 80,
      heightCm: 180,
      ageYears: 30,
      biologicalSex: BiologicalSex.MALE,
    });

    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.bmr).toBe(1780);
      expect(result.calculationMethod).toBe('MIFFLIN_ST_JEOR_MALE');
      expect(result.formula).toBe('Mifflin-St Jeor (1990)');
    }
  });

  it('correctly calculates BMR for a standard adult female', () => {
    // 60 kg, 165 cm, 28 years old female
    // BMR = 10(60) + 6.25(165) - 5(28) - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 -> 1330 kcal
    const result = calculateBmr({
      weightKg: 60,
      heightCm: 165,
      ageYears: 28,
      biologicalSex: BiologicalSex.FEMALE,
    });

    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.bmr).toBe(1330);
      expect(result.calculationMethod).toBe('MIFFLIN_ST_JEOR_FEMALE');
    }
  });

  describe('Biological Sex vs Gender Identity Handling', () => {
    it('uses biological sex and documents conflict when biological sex and gender identity differ', () => {
      // Trans woman: biologicalSex MALE, gender FEMALE
      const result = calculateBmr({
        weightKg: 75,
        heightCm: 175,
        ageYears: 27,
        biologicalSex: BiologicalSex.MALE,
        gender: Gender.FEMALE,
      });

      expect(result.status).toBe('SUCCESS');
      if (result.status === 'SUCCESS') {
        expect(result.calculationMethod).toBe('MIFFLIN_ST_JEOR_MALE');
        expect(result.notes.some(n => n.includes('differs from biological sex'))).toBe(true);
      }
    });

    it('does NOT infer biological sex from gender when biologicalSex is omitted', () => {
      // User specifies gender MALE but omits biologicalSex
      const result = calculateBmr({
        weightKg: 75,
        heightCm: 175,
        ageYears: 27,
        gender: Gender.MALE,
      });

      expect(result.status).toBe('SUCCESS');
      if (result.status === 'SUCCESS') {
        // Must use UNVALIDATED_SEX_AVERAGE, NOT MIFFLIN_ST_JEOR_MALE!
        expect(result.calculationMethod).toBe('UNVALIDATED_SEX_AVERAGE');
        expect(
          result.notes.some(n => n.includes('NOT a clinically validated standalone equation')),
        ).toBe(true);
        expect(
          result.notes.some(n =>
            n.includes('Predictive equations are not inferred from gender identity'),
          ),
        ).toBe(true);
      }
    });

    it('calculates unvalidated population midpoint when both sex and gender are omitted', () => {
      // Midpoint offset = -78
      // BMR = 10(70) + 6.25(170) - 5(25) - 78 = 700 + 1062.5 - 125 - 78 = 1559.5 -> 1560 kcal
      const result = calculateBmr({
        weightKg: 70,
        heightCm: 170,
        ageYears: 25,
      });

      expect(result.status).toBe('SUCCESS');
      if (result.status === 'SUCCESS') {
        expect(result.bmr).toBe(1560);
        expect(result.calculationMethod).toBe('UNVALIDATED_SEX_AVERAGE');
      }
    });
  });

  describe('Numeric Validation & Physiological Boundaries', () => {
    it('rejects NaN, Infinity, negative, and zero values for biometrics', () => {
      expect(
        calculateBmr({
          weightKg: NaN,
          heightCm: 170,
          ageYears: 25,
          biologicalSex: BiologicalSex.MALE,
        }).status,
      ).toBe('UNSUPPORTED');

      expect(
        calculateBmr({
          weightKg: 70,
          heightCm: Infinity,
          ageYears: 25,
          biologicalSex: BiologicalSex.MALE,
        }).status,
      ).toBe('UNSUPPORTED');

      expect(
        calculateBmr({
          weightKg: -70,
          heightCm: 170,
          ageYears: 25,
          biologicalSex: BiologicalSex.MALE,
        }).status,
      ).toBe('UNSUPPORTED');

      expect(
        calculateBmr({
          weightKg: 70,
          heightCm: 0,
          ageYears: 25,
          biologicalSex: BiologicalSex.MALE,
        }).status,
      ).toBe('UNSUPPORTED');
    });

    it('rejects out-of-bounds biometrics (< 30kg, > 350kg, < 100cm, > 250cm, > 120y)', () => {
      expect(
        calculateBmr({
          weightKg: 25,
          heightCm: 170,
          ageYears: 25,
          biologicalSex: BiologicalSex.MALE,
        }).status,
      ).toBe('UNSUPPORTED');

      expect(
        calculateBmr({
          weightKg: 400,
          heightCm: 170,
          ageYears: 25,
          biologicalSex: BiologicalSex.MALE,
        }).status,
      ).toBe('UNSUPPORTED');

      expect(
        calculateBmr({
          weightKg: 70,
          heightCm: 85,
          ageYears: 25,
          biologicalSex: BiologicalSex.MALE,
        }).status,
      ).toBe('UNSUPPORTED');
    });
  });

  describe('Health & Safety Restrictions for Unsupported Populations', () => {
    it('rejects calculation for minors (age 17) with explicit safety reason', () => {
      const result = calculateBmr({
        weightKg: 60,
        heightCm: 170,
        ageYears: 17,
        biologicalSex: BiologicalSex.FEMALE,
      });

      expect(result.status).toBe('UNSUPPORTED');
      if (result.status === 'UNSUPPORTED') {
        expect(result.reason).toBe('MINORS_NOT_SUPPORTED');
        expect(result.message).toContain('not clinically validated for individuals under 18');
      }
    });

    it('accepts age 18 as the valid lower adult boundary', () => {
      const result = calculateBmr({
        weightKg: 65,
        heightCm: 172,
        ageYears: 18,
        biologicalSex: BiologicalSex.MALE,
      });

      expect(result.status).toBe('SUCCESS');
    });

    it('rejects calculation during pregnancy with clinical disclaimer', () => {
      const result = calculateBmr({
        weightKg: 68,
        heightCm: 165,
        ageYears: 29,
        biologicalSex: BiologicalSex.FEMALE,
        isPregnant: true,
      });

      expect(result.status).toBe('UNSUPPORTED');
      if (result.status === 'UNSUPPORTED') {
        expect(result.reason).toBe('PREGNANCY_LACTATION_NOT_SUPPORTED');
      }
    });

    it('rejects calculation during lactation', () => {
      const result = calculateBmr({
        weightKg: 65,
        heightCm: 165,
        ageYears: 30,
        biologicalSex: BiologicalSex.FEMALE,
        isLactating: true,
      });

      expect(result.status).toBe('UNSUPPORTED');
      if (result.status === 'UNSUPPORTED') {
        expect(result.reason).toBe('PREGNANCY_LACTATION_NOT_SUPPORTED');
      }
    });
  });
});
