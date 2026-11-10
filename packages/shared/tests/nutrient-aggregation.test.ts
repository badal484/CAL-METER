import { describe, it, expect } from 'vitest';
import { aggregateNutrients } from '../src/formulas/nutrient-aggregation.js';
import { NutrientProfile } from '../src/types/index.js';
import { DomainValidationError } from '../src/errors/index.js';

describe('Nutrient Aggregation', () => {
  it('correctly aggregates multiple food items in a meal', () => {
    // Meal: Dal (180 kcal) + 2 Phulkas (150 kcal) + Salad (40 kcal)
    const dal: NutrientProfile = {
      calories: 180,
      proteinGrams: 9,
      carbsGrams: 24,
      fatGrams: 5.5,
      fiberGrams: 6,
      micronutrients: { ironMg: 2.1, sodiumMg: 350 },
    };

    const rotis: NutrientProfile = {
      calories: 150,
      proteinGrams: 5.2,
      carbsGrams: 30,
      fatGrams: 0.8,
      fiberGrams: 4.5,
      micronutrients: { ironMg: 1.2, sodiumMg: 5 },
    };

    const salad: NutrientProfile = {
      calories: 40,
      proteinGrams: 1.5,
      carbsGrams: 8,
      fatGrams: 0.2,
      fiberGrams: 3,
      micronutrients: { sodiumMg: 20 },
    };

    const total = aggregateNutrients([dal, rotis, salad]);

    // 180 + 150 + 40 = 370
    expect(total.calories).toBe(370);
    // 9 + 5.2 + 1.5 = 15.7
    expect(total.proteinGrams).toBe(15.7);
    // 24 + 30 + 8 = 62
    expect(total.carbsGrams).toBe(62);
    // 5.5 + 0.8 + 0.2 = 6.5
    expect(total.fatGrams).toBe(6.5);
    // 6 + 4.5 + 3 = 13.5
    expect(total.fiberGrams).toBe(13.5);
    // 2.1 + 1.2 = 3.3
    expect(total.micronutrients?.ironMg).toBe(3.3);
    // 350 + 5 + 20 = 375
    expect(total.micronutrients?.sodiumMg).toBe(375);
  });

  it('handles empty food profile list gracefully', () => {
    const total = aggregateNutrients([]);

    expect(total.calories).toBe(0);
    expect(total.proteinGrams).toBe(0);
    expect(total.carbsGrams).toBe(0);
    expect(total.fatGrams).toBe(0);
    expect(total.fiberGrams).toBeUndefined();
    expect(total.micronutrients).toBeUndefined();
  });

  describe('Numeric Validation & Error Handling', () => {
    const validProfile: NutrientProfile = {
      calories: 100,
      proteinGrams: 10,
      carbsGrams: 10,
      fatGrams: 2,
    };

    it('rejects profiles with NaN or Infinity macronutrients', () => {
      expect(() => aggregateNutrients([{ ...validProfile, calories: NaN }])).toThrow(
        DomainValidationError,
      );
      expect(() => aggregateNutrients([{ ...validProfile, proteinGrams: Infinity }])).toThrow(
        DomainValidationError,
      );
      expect(() => aggregateNutrients([{ ...validProfile, carbsGrams: -Infinity }])).toThrow(
        DomainValidationError,
      );
      expect(() => aggregateNutrients([{ ...validProfile, fatGrams: NaN }])).toThrow(
        DomainValidationError,
      );
    });

    it('rejects profiles with negative macronutrients', () => {
      expect(() => aggregateNutrients([{ ...validProfile, calories: -50 }])).toThrow(
        DomainValidationError,
      );
      expect(() => aggregateNutrients([{ ...validProfile, proteinGrams: -5 }])).toThrow(
        DomainValidationError,
      );
      expect(() => aggregateNutrients([{ ...validProfile, carbsGrams: -10 }])).toThrow(
        DomainValidationError,
      );
      expect(() => aggregateNutrients([{ ...validProfile, fatGrams: -2 }])).toThrow(
        DomainValidationError,
      );
    });

    it('rejects profiles with NaN, Infinity, or negative fiber', () => {
      expect(() => aggregateNutrients([{ ...validProfile, fiberGrams: NaN }])).toThrow(
        DomainValidationError,
      );
      expect(() => aggregateNutrients([{ ...validProfile, fiberGrams: -3 }])).toThrow(
        DomainValidationError,
      );
      expect(() => aggregateNutrients([{ ...validProfile, fiberGrams: Infinity }])).toThrow(
        DomainValidationError,
      );
    });

    it('rejects profiles with NaN, Infinity, or negative micronutrient values', () => {
      expect(() =>
        aggregateNutrients([{ ...validProfile, micronutrients: { ironMg: NaN } }]),
      ).toThrow(DomainValidationError);
      expect(() =>
        aggregateNutrients([{ ...validProfile, micronutrients: { sodiumMg: -100 } }]),
      ).toThrow(DomainValidationError);
      expect(() =>
        aggregateNutrients([{ ...validProfile, micronutrients: { zincMg: Infinity } }]),
      ).toThrow(DomainValidationError);
    });

    describe('Aggregation Overflow Prevention', () => {
      const massiveNumber = 1.5e308; // Individually finite, but addition will overflow to Infinity

      it('rejects accumulated calorie overflow from individually finite values', () => {
        const item1: NutrientProfile = { ...validProfile, calories: massiveNumber };
        const item2: NutrientProfile = { ...validProfile, calories: massiveNumber };
        expect(() => aggregateNutrients([item1, item2])).toThrow(DomainValidationError);
      });

      it('rejects accumulated protein overflow', () => {
        const item1: NutrientProfile = { ...validProfile, proteinGrams: massiveNumber };
        const item2: NutrientProfile = { ...validProfile, proteinGrams: massiveNumber };
        expect(() => aggregateNutrients([item1, item2])).toThrow(DomainValidationError);
      });

      it('rejects accumulated carbohydrate overflow', () => {
        const item1: NutrientProfile = { ...validProfile, carbsGrams: massiveNumber };
        const item2: NutrientProfile = { ...validProfile, carbsGrams: massiveNumber };
        expect(() => aggregateNutrients([item1, item2])).toThrow(DomainValidationError);
      });

      it('rejects accumulated fat overflow', () => {
        const item1: NutrientProfile = { ...validProfile, fatGrams: massiveNumber };
        const item2: NutrientProfile = { ...validProfile, fatGrams: massiveNumber };
        expect(() => aggregateNutrients([item1, item2])).toThrow(DomainValidationError);
      });

      it('rejects accumulated fiber overflow', () => {
        const item1: NutrientProfile = { ...validProfile, fiberGrams: massiveNumber };
        const item2: NutrientProfile = { ...validProfile, fiberGrams: massiveNumber };
        expect(() => aggregateNutrients([item1, item2])).toThrow(DomainValidationError);
      });

      it('rejects accumulated micronutrient overflow', () => {
        const item1: NutrientProfile = {
          ...validProfile,
          micronutrients: { calciumMg: massiveNumber },
        };
        const item2: NutrientProfile = {
          ...validProfile,
          micronutrients: { calciumMg: massiveNumber },
        };
        expect(() => aggregateNutrients([item1, item2])).toThrow(DomainValidationError);
      });
    });
  });
});
