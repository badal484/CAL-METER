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
      proteinPercentage: 0.30,
      carbsPercentage: 0.40,
      fatPercentage: 0.30
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

  it('supports explicit custom gram amounts', () => {
    const result = calculateMacronutrients({
      dailyCalories: 2100,
      customProteinGrams: 160,
      customCarbsGrams: 220,
      customFatGrams: 65
    });

    expect(result.proteinGrams).toBe(160);
    expect(result.carbsGrams).toBe(220);
    expect(result.fatGrams).toBe(65);
    expect(result.proteinCalories).toBe(640);
    expect(result.carbsCalories).toBe(880);
    expect(result.fatCalories).toBe(585);
  });

  it('throws DomainValidationError if percentages do not sum to 100%', () => {
    expect(() =>
      calculateMacronutrients({
        dailyCalories: 2000,
        proteinPercentage: 0.40,
        carbsPercentage: 0.40,
        fatPercentage: 0.40 // Sum = 1.20 (120%)
      })
    ).toThrow(DomainValidationError);
  });

  it('throws DomainValidationError if dailyCalories <= 0', () => {
    expect(() =>
      calculateMacronutrients({
        dailyCalories: 0
      })
    ).toThrow(DomainValidationError);
  });

  it('throws DomainValidationError for negative custom grams', () => {
    expect(() =>
      calculateMacronutrients({
        dailyCalories: 2000,
        customProteinGrams: -10,
        customCarbsGrams: 200,
        customFatGrams: 60
      })
    ).toThrow(DomainValidationError);
  });
});

