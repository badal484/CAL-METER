import { describe, it, expect } from 'vitest';
import { scaleNutrients } from '../src/formulas/nutrition-scaling.js';
import { NutrientProfile } from '../src/types/index.js';
import { DomainValidationError } from '../src/errors/index.js';

describe('Nutrition Scaling', () => {
  const basePer100g: NutrientProfile = {
    calories: 165,
    proteinGrams: 31,
    carbsGrams: 0,
    fatGrams: 3.6,
    fiberGrams: 0,
    micronutrients: {
      ironMg: 1.04,
      sodiumMg: 74,
    },
  };

  it('correctly scales nutrients from 100g to 250g (factor 2.5)', () => {
    // 165 * 2.5 = 412.5
    // 31 * 2.5 = 77.5
    // 3.6 * 2.5 = 9.0
    // iron: 1.04 * 2.5 = 2.6
    // sodium: 74 * 2.5 = 185
    const scaled = scaleNutrients(basePer100g, 250, 100);

    expect(scaled.calories).toBe(412.5);
    expect(scaled.proteinGrams).toBe(77.5);
    expect(scaled.carbsGrams).toBe(0);
    expect(scaled.fatGrams).toBe(9);
    expect(scaled.fiberGrams).toBe(0);
    expect(scaled.micronutrients?.ironMg).toBe(2.6);
    expect(scaled.micronutrients?.sodiumMg).toBe(185);
  });

  it('returns all zeros when target grams is 0', () => {
    const scaled = scaleNutrients(basePer100g, 0, 100);

    expect(scaled.calories).toBe(0);
    expect(scaled.proteinGrams).toBe(0);
    expect(scaled.fatGrams).toBe(0);
    expect(scaled.micronutrients?.ironMg).toBe(0);
  });

  it('scales from custom reference serving size (e.g. 1 package = 45g to 90g)', () => {
    const packageNutrients: NutrientProfile = {
      calories: 220,
      proteinGrams: 4,
      carbsGrams: 28,
      fatGrams: 11,
    };

    const scaled = scaleNutrients(packageNutrients, 90, 45); // 2 packages
    expect(scaled.calories).toBe(440);
    expect(scaled.proteinGrams).toBe(8);
    expect(scaled.carbsGrams).toBe(56);
    expect(scaled.fatGrams).toBe(22);
  });

  it('throws DomainValidationError for negative target grams', () => {
    expect(() => scaleNutrients(basePer100g, -50, 100)).toThrow(DomainValidationError);
  });

  it('throws DomainValidationError for zero or negative reference grams', () => {
    expect(() => scaleNutrients(basePer100g, 100, 0)).toThrow(DomainValidationError);
  });
});
