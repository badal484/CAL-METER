import { describe, it, expect } from 'vitest';
import { calculateCalorieTarget } from '../src/formulas/targets.js';
import { PrimaryGoal } from '../src/constants/enums.js';
import { DomainValidationError } from '../src/errors/index.js';

describe('Calorie Target Calculation', () => {
  const bmr = 1700;
  const tdee = 2500;

  it('calculates standard moderate weight loss target (0.5 kg/week = -550 kcal)', () => {
    // 0.5 kg/week -> (0.5 * 7700) / 7 = 550 kcal deficit
    // Target = 2500 - 550 = 1950 kcal
    const result = calculateCalorieTarget({
      tdee,
      bmr,
      primaryGoal: PrimaryGoal.LOSE_WEIGHT,
      paceKgPerWeek: 0.5,
    });

    expect(result.dailyCalories).toBe(1950);
    expect(result.dailyDeficitOrSurplus).toBe(-550);
    expect(result.paceKgPerWeek).toBe(0.5);
    expect(result.deficitPercentageOfTdee).toBe(22);
    expect(result.isBelowBmr).toBe(false);
    expect(result.warnings.length).toBe(0);
  });

  it('calculates maintenance calorie target (= TDEE)', () => {
    const result = calculateCalorieTarget({
      tdee,
      bmr,
      primaryGoal: PrimaryGoal.MAINTAIN_WEIGHT,
    });

    expect(result.dailyCalories).toBe(2500);
    expect(result.dailyDeficitOrSurplus).toBe(0);
    expect(result.paceKgPerWeek).toBe(0);
  });

  it('calculates muscle gain target with moderate surplus', () => {
    // 10% of 2500 = +250 kcal -> 2750 kcal
    const result = calculateCalorieTarget({
      tdee,
      bmr,
      primaryGoal: PrimaryGoal.BUILD_MUSCLE,
    });

    expect(result.dailyCalories).toBe(2750);
    expect(result.dailyDeficitOrSurplus).toBe(250);
  });

  describe('Removal of Arbitrary Floors & Transparent Calculation', () => {
    it('calculates targets below 800 kcal transparently without clamping to an arbitrary floor', () => {
      // TDEE 2000, BMR 1500, deficit of 1400 kcal (approx 1.27 kg/week)
      // 2000 - 1400 = 600 kcal. Must NOT clamp to 800!
      const result = calculateCalorieTarget({
        tdee: 2000,
        bmr: 1500,
        primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        paceKgPerWeek: 1.2727,
      });

      expect(result.dailyCalories).toBe(600); // Transparent 600 kcal, not clamped to 800!
      expect(result.isBelowBmr).toBe(true);
      expect(result.warnings.some(w => w.includes('below your estimated resting BMR'))).toBe(true);
      expect(result.warnings.some(w => w.includes('exceeds 25% of TDEE'))).toBe(true);
    });

    it('flags non-viable targets (<= 0 kcal) with explicit safety warning without clamping', () => {
      // Requested pace 3.0 kg/week -> deficit = (3.0 * 7700) / 7 = 3300 kcal
      // Target = 2000 - 3300 = -1300 kcal
      const result = calculateCalorieTarget({
        tdee: 2000,
        bmr: 1500,
        primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        paceKgPerWeek: 3.0,
      });

      expect(result.dailyCalories).toBe(-1300);
      expect(result.warnings.some(w => w.includes('non-viable'))).toBe(true);
    });

    it('does not silently alter requested pace', () => {
      const result = calculateCalorieTarget({
        tdee,
        bmr,
        primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        paceKgPerWeek: 1.5,
      });

      // Pace remains 1.5, not clamped to 0.5 or 1.0!
      expect(result.paceKgPerWeek).toBe(1.5);
      expect(result.warnings.some(w => w.includes('considered aggressive'))).toBe(true);
    });

    it('allows custom calorie overrides below 500 kcal without arbitrary rejection', () => {
      // User sets custom 450 kcal
      const result = calculateCalorieTarget({
        tdee,
        bmr,
        primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        customCalorieOverride: 450,
      });

      expect(result.dailyCalories).toBe(450);
      expect(result.warnings.some(w => w.includes('aggressive deficit'))).toBe(true);
      expect(result.warnings.some(w => w.includes('below your estimated resting BMR'))).toBe(true);
    });
  });

  describe('Input Validation & Error Handling', () => {
    it('rejects non-finite, zero, and negative TDEE and BMR', () => {
      expect(() =>
        calculateCalorieTarget({
          tdee: NaN,
          bmr: 1500,
          primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        }),
      ).toThrow(DomainValidationError);

      expect(() =>
        calculateCalorieTarget({
          tdee: 2000,
          bmr: -1500,
          primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        }),
      ).toThrow(DomainValidationError);

      expect(() =>
        calculateCalorieTarget({
          tdee: 0,
          bmr: 1500,
          primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        }),
      ).toThrow(DomainValidationError);
    });

    it('rejects non-finite, zero, and negative weight loss pace', () => {
      expect(() =>
        calculateCalorieTarget({
          tdee,
          bmr,
          primaryGoal: PrimaryGoal.LOSE_WEIGHT,
          paceKgPerWeek: -0.5,
        }),
      ).toThrow(DomainValidationError);

      expect(() =>
        calculateCalorieTarget({
          tdee,
          bmr,
          primaryGoal: PrimaryGoal.LOSE_WEIGHT,
          paceKgPerWeek: 0,
        }),
      ).toThrow(DomainValidationError);

      expect(() =>
        calculateCalorieTarget({
          tdee,
          bmr,
          primaryGoal: PrimaryGoal.LOSE_WEIGHT,
          paceKgPerWeek: NaN,
        }),
      ).toThrow(DomainValidationError);
    });

    it('rejects non-finite and negative custom calorie overrides', () => {
      expect(() =>
        calculateCalorieTarget({
          tdee,
          bmr,
          primaryGoal: PrimaryGoal.LOSE_WEIGHT,
          customCalorieOverride: -500,
        }),
      ).toThrow(DomainValidationError);

      expect(() =>
        calculateCalorieTarget({
          tdee,
          bmr,
          primaryGoal: PrimaryGoal.LOSE_WEIGHT,
          customCalorieOverride: NaN,
        }),
      ).toThrow(DomainValidationError);
    });
  });
});
