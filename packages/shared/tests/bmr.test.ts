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
    }
  });

  it('calculates population median when biological sex is unspecified', () => {
    // Midpoint offset = -78
    // BMR = 10(70) + 6.25(170) - 5(25) - 78 = 700 + 1062.5 - 125 - 78 = 1559.5 -> 1560 kcal
    const result = calculateBmr({
      weightKg: 70,
      heightCm: 170,
      ageYears: 25,
      gender: Gender.PREFER_NOT_TO_SAY,
    });

    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.bmr).toBe(1560);
      expect(result.disclaimers.some(d => d.includes('population median'))).toBe(true);
    }
  });

  it('correctly validates the age 18 lower adult boundary', () => {
    const result = calculateBmr({
      weightKg: 65,
      heightCm: 172,
      ageYears: 18,
      biologicalSex: BiologicalSex.MALE,
    });

    expect(result.status).toBe('SUCCESS');
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

    it('rejects calculation for children (age 10)', () => {
      const result = calculateBmr({
        weightKg: 35,
        heightCm: 135,
        ageYears: 10,
        biologicalSex: BiologicalSex.MALE,
      });

      expect(result.status).toBe('UNSUPPORTED');
      if (result.status === 'UNSUPPORTED') {
        expect(result.reason).toBe('MINORS_NOT_SUPPORTED');
      }
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
        expect(result.message).toContain('gestational or lactational metabolic demands');
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

    it('rejects out-of-bounds weight below 30 kg', () => {
      const result = calculateBmr({
        weightKg: 25,
        heightCm: 150,
        ageYears: 22,
        biologicalSex: BiologicalSex.FEMALE,
      });

      expect(result.status).toBe('UNSUPPORTED');
      if (result.status === 'UNSUPPORTED') {
        expect(result.reason).toBe('OUT_OF_BOUNDS_BIOMETRICS');
      }
    });

    it('rejects out-of-bounds height above 250 cm', () => {
      const result = calculateBmr({
        weightKg: 90,
        heightCm: 260,
        ageYears: 25,
        biologicalSex: BiologicalSex.MALE,
      });

      expect(result.status).toBe('UNSUPPORTED');
      if (result.status === 'UNSUPPORTED') {
        expect(result.reason).toBe('OUT_OF_BOUNDS_BIOMETRICS');
      }
    });
  });
});
