import { describe, it, expect } from 'vitest';
import { calculateMacronutrients } from '../src/formulas/macros.js';
import { DomainValidationError } from '../src/errors/index.js';

describe('Macronutrient Calculation', () => {
  it('calculates standard 30/40/30 distribution for 2,000 kcal', () => {
    // 2,000 kcal:
    // Protein (30%): 600 kcal / 4 = 150g
    // Carbs (40%): 800 kcal / 4 = 200g
    // Fat (30%): 600 kcal / 9 = 66.7g
    // Fiber: (2000 / 1000) * 14 = 28g
    const result = calculateMacronutrients({
      dailyCalories: 2000,
      proteinPercentage: 0.3,
      carbsPercentage: 0.4,
      fatPercentage: 0.3,
    });

    expect(result.dailyCalories).toBe(2000);
    expect(result.proteinGrams).toBe(150);
    expect(result.carbsGrams).toBe(200);
    expect(result.fatGrams).toBe(66.7);
    expect(result.fiberGrams).toBe(28);
    expect(result.proteinCalories).toBe(600);
    expect(result.carbsCalories).toBe(800);
    expect(result.fatCalories).toBe(600);
  });

  it('supports complete custom gram amounts', () => {
    const result = calculateMacronutrients({
      dailyCalories: 2100,
      customProteinGrams: 160,
      customCarbsGrams: 220,
      customFatGrams: 65,
    });

    expect(result.proteinGrams).toBe(160);
    expect(result.carbsGrams).toBe(220);
    expect(result.fatGrams).toBe(65);
    expect(result.proteinCalories).toBe(640);
    expect(result.carbsCalories).toBe(880);
    expect(result.fatCalories).toBe(585);
  });

  describe('Partial Custom Macro Rejection', () => {
    it('rejects partial custom inputs when only 1 or 2 macro grams are provided', () => {
      // Provided protein and carbs, but omitted fat
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          customProteinGrams: 150,
          customCarbsGrams: 200,
        }),
      ).toThrow(DomainValidationError);

      // Provided only protein
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          customProteinGrams: 150,
        }),
      ).toThrow(DomainValidationError);

      // Provided carbs and fat, omitted protein
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          customCarbsGrams: 200,
          customFatGrams: 60,
        }),
      ).toThrow(DomainValidationError);
    });
  });

  describe('Numeric Validation & Error Handling', () => {
    it('throws DomainValidationError if percentages do not sum to 100%', () => {
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          proteinPercentage: 0.4,
          carbsPercentage: 0.4,
          fatPercentage: 0.4, // Sum = 1.20 (120%)
        }),
      ).toThrow(DomainValidationError);

      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          proteinPercentage: 0.2,
          carbsPercentage: 0.3,
          fatPercentage: 0.2, // Sum = 0.70 (70%)
        }),
      ).toThrow(DomainValidationError);
    });

    it('rejects individual percentages > 1.0 or < 0.0', () => {
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          proteinPercentage: 1.5,
          carbsPercentage: -0.2,
          fatPercentage: -0.3,
        }),
      ).toThrow(DomainValidationError);
    });

    it('rejects non-finite percentage inputs (NaN, Infinity)', () => {
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          proteinPercentage: NaN,
          carbsPercentage: 0.5,
          fatPercentage: 0.5,
        }),
      ).toThrow(DomainValidationError);
    });

    it('rejects non-finite, zero, and negative dailyCalories', () => {
      expect(() => calculateMacronutrients({ dailyCalories: 0 })).toThrow(DomainValidationError);
      expect(() => calculateMacronutrients({ dailyCalories: -2000 })).toThrow(
        DomainValidationError,
      );
      expect(() => calculateMacronutrients({ dailyCalories: NaN })).toThrow(DomainValidationError);
      expect(() => calculateMacronutrients({ dailyCalories: Infinity })).toThrow(
        DomainValidationError,
      );
    });

    it('rejects non-finite and negative custom grams', () => {
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          customProteinGrams: -10,
          customCarbsGrams: 200,
          customFatGrams: 60,
        }),
      ).toThrow(DomainValidationError);

      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          customProteinGrams: NaN,
          customCarbsGrams: 200,
          customFatGrams: 60,
        }),
      ).toThrow(DomainValidationError);
    });
  });
});
