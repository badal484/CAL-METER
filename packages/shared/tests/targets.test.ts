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
      paceKgPerWeek: 0.5
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
      primaryGoal: PrimaryGoal.MAINTAIN_WEIGHT
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
      primaryGoal: PrimaryGoal.BUILD_MUSCLE
    });

    expect(result.dailyCalories).toBe(2750);
    expect(result.dailyDeficitOrSurplus).toBe(250);
  });

  describe('Health & Safety Boundary Warnings', () => {
    it('flags aggressive deficit warning when target deficit exceeds 25% of TDEE', () => {
      // 0.9 kg/week -> (0.9 * 7700) / 7 = 990 kcal deficit
      // 990 / 2500 = 39.6% deficit
      const result = calculateCalorieTarget({
        tdee,
        bmr,
        primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        paceKgPerWeek: 0.9
      });

      expect(result.deficitPercentageOfTdee).toBeGreaterThan(25);
      expect(result.warnings.some(w => w.includes('exceeds 25% of TDEE'))).toBe(true);
    });

    it('flags warning when aggressive pace exceeds 1.0 kg/week', () => {
      const result = calculateCalorieTarget({
        tdee,
        bmr,
        primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        paceKgPerWeek: 1.2
      });

      expect(result.warnings.some(w => w.includes('considered aggressive'))).toBe(true);
    });

    it('flags warning when target calories dip below BMR', () => {
      // TDEE: 1800, BMR: 1500, deficit: 550 -> Target: 1250 (< 1500 BMR)
      const result = calculateCalorieTarget({
        tdee: 1800,
        bmr: 1500,
        primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        paceKgPerWeek: 0.5
      });

      expect(result.isBelowBmr).toBe(true);
      expect(result.warnings.some(w => w.includes('below your estimated resting BMR'))).toBe(true);
    });

    it('accepts valid custom calorie override and checks safety implications', () => {
      const result = calculateCalorieTarget({
        tdee,
        bmr,
        primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        customCalorieOverride: 1800
      });

      expect(result.dailyCalories).toBe(1800);
      expect(result.dailyDeficitOrSurplus).toBe(-700);
    });

    it('rejects extreme custom calorie override (< 500 kcal)', () => {
      expect(() =>
        calculateCalorieTarget({
          tdee,
          bmr,
          primaryGoal: PrimaryGoal.LOSE_WEIGHT,
          customCalorieOverride: 400
        })
      ).toThrow(DomainValidationError);
    });
  });
});

