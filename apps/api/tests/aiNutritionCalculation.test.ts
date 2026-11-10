import { describe, it, expect } from 'vitest';
import {
  NutritionCalculationService,
  FoodItemWithNutrition,
} from '../src/services/nutritionCalculation.service.js';
import { DomainValidationError } from '@calmeter/shared';

describe('Deterministic AI Nutrition Calculation & Aggregation Engine', () => {
  const service = new NutritionCalculationService();

  const mockRoti: FoodItemWithNutrition = {
    id: 'roti-uuid',
    name: 'Whole Wheat Roti / Phulka',
    standardWeightGrams: 35,
    calories: 264.0, // per 100g
    protein: 9.2,
    carbs: 55.4,
    fat: 1.2,
    fiber: 8.6,
    nutrientProfile: {
      calories: 264.0,
      protein: 9.2,
      carbs: 55.4,
      fat: 1.2,
      fiber: 8.6,
      sodium: 15.0, // 15mg per 100g
      sugar: 0.0, // verified 0g sugar
      saturatedFat: 0.2,
      vitaminD: null, // unknown / not analyzed
      vitaminB12: null, // unknown
    },
    servingConversions: [
      {
        unitName: 'piece',
        servingDescription: '1 medium phulka',
        gramWeight: 35,
        isDefault: true,
      },
      {
        unitName: 'roti',
        servingDescription: '1 medium roti',
        gramWeight: 35,
        isDefault: false,
      },
    ],
  };

  const mockDal: FoodItemWithNutrition = {
    id: 'dal-uuid',
    name: 'Yellow Dal Tadka (Home-style)',
    standardWeightGrams: 200,
    calories: 92.0, // per 100g
    protein: 4.6,
    carbs: 12.2,
    fat: 2.8,
    fiber: 3.1,
    nutrientProfile: {
      calories: 92.0,
      protein: 4.6,
      carbs: 12.2,
      fat: 2.8,
      fiber: 3.1,
      sodium: 280.0, // 280mg per 100g
      sugar: 0.8,
      saturatedFat: 1.1,
      calcium: 24.0,
      vitaminD: null,
    },
    servingConversions: [
      {
        unitName: 'katori',
        servingDescription: '1 medium bowl/katori (~200g)',
        gramWeight: 200,
        isDefault: true,
      },
      {
        unitName: 'bowl',
        servingDescription: '1 medium bowl (~200g)',
        gramWeight: 200,
        isDefault: false,
      },
    ],
  };

  it('calculates deterministic nutrients for discrete piece unit (2 pieces phulka = 70g)', () => {
    const calc = service.calculateItemNutrition('cand-1', mockRoti, 2, 'piece');

    expect(calc.resolvedGramWeight).toBe(70.0);
    // 264 * 70 / 100 = 184.8
    expect(calc.calories).toBe(184.8);
    // 9.2 * 70 / 100 = 6.44 -> 6.4
    expect(calc.protein).toBe(6.4);
    // 55.4 * 70 / 100 = 38.78 -> 38.8
    expect(calc.carbs).toBe(38.8);
    // 1.2 * 70 / 100 = 0.84 -> 0.8
    expect(calc.fat).toBe(0.8);
    expect(calc.fiber).toBe(6.0);
    expect(calc.provenance).toBe('CALCULATED_BACKEND');
  });

  it('calculates deterministic nutrients for household volume unit (1 katori dal = 200g)', () => {
    const calc = service.calculateItemNutrition('cand-2', mockDal, 1, 'katori');

    expect(calc.resolvedGramWeight).toBe(200.0);
    // 92 * 200 / 100 = 184.0
    expect(calc.calories).toBe(184.0);
    expect(calc.protein).toBe(9.2);
    expect(calc.carbs).toBe(24.4);
    expect(calc.fat).toBe(5.6);
    expect(calc.fiber).toBe(6.2);
    // 280 * 2 = 560 mg
    expect(calc.sodium).toBe(560.0);
  });

  it('strictly preserves unknown micronutrients as null rather than assuming zero', () => {
    const calc = service.calculateItemNutrition('cand-1', mockRoti, 2, 'piece');

    // Vitamin D and B12 were unknown (null) in mockRoti
    expect(calc.micronutrients.vitaminD).toBeNull();
    expect(calc.micronutrients.vitaminB12).toBeNull();

    // Sugar was verified 0.0, so scaled value is 0.0 (not null)
    expect(calc.sugar).toBe(0.0);
  });

  it('aggregates multi-item meal into a unified nutrient summary', () => {
    const rotiCalc = service.calculateItemNutrition('cand-1', mockRoti, 2, 'piece'); // 184.8 kcal
    const dalCalc = service.calculateItemNutrition('cand-2', mockDal, 1, 'katori'); // 184.0 kcal

    const aggregate = service.aggregateMealNutrition([rotiCalc, dalCalc]);

    expect(aggregate.itemCount).toBe(2);
    // 184.8 + 184.0 = 368.8
    expect(aggregate.calories).toBe(368.8);
    // 6.4 + 9.2 = 15.6
    expect(aggregate.protein).toBe(15.6);
    // 38.8 + 24.4 = 63.2
    expect(aggregate.carbs).toBe(63.2);
    // 0.8 + 5.6 = 6.4
    expect(aggregate.fat).toBe(6.4);
    // 6.0 + 6.2 = 12.2
    expect(aggregate.fiber).toBe(12.2);
    // Sodium: 10.5 (roti) + 560 (dal) = 570.5
    expect(aggregate.sodium).toBe(570.5);
  });

  it('rejects invalid or non-finite portion quantities with DomainValidationError', () => {
    expect(() => {
      service.calculateItemNutrition('cand-1', mockRoti, 0, 'piece');
    }).toThrow(DomainValidationError);

    expect(() => {
      service.calculateItemNutrition('cand-1', mockRoti, -2, 'piece');
    }).toThrow(DomainValidationError);

    expect(() => {
      service.calculateItemNutrition('cand-1', mockRoti, NaN, 'piece');
    }).toThrow(DomainValidationError);

    expect(() => {
      service.calculateItemNutrition('cand-1', mockRoti, Infinity, 'piece');
    }).toThrow(DomainValidationError);
  });

  it('recalculates nutrition correctly when user adjusts portion quantity', () => {
    // Original portion: 1 katori dal = 184 kcal
    const original = service.calculateItemNutrition('cand-2', mockDal, 1, 'katori');
    expect(original.calories).toBe(184.0);

    // User adjusts portion to 1.5 katoris (300g): 92 * 3 = 276.0 kcal
    const adjusted = service.calculateItemNutrition('cand-2', mockDal, 1.5, 'katori');
    expect(adjusted.resolvedGramWeight).toBe(300.0);
    expect(adjusted.calories).toBe(276.0);
    expect(adjusted.protein).toBe(13.8);
    expect(adjusted.carbs).toBe(36.6);
    expect(adjusted.fat).toBe(8.4);
  });
});
