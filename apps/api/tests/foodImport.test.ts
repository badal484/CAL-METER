import { describe, it, expect } from 'vitest';
import { FoodSource } from '@calmeter/shared';
import { ReferenceIndianFoodAdapter } from '../src/importers/adapters/referenceIndianFood.adapter.js';
import { UsdaFoodDataAdapter } from '../src/importers/adapters/usdaFoodData.adapter.js';
import { OpenFoodFactsAdapter } from '../src/importers/adapters/openFoodFacts.adapter.js';
import { IcmrNinAdapter } from '../src/importers/adapters/icmrNin.adapter.js';

describe('Food Data Source Adapters & Normalization', () => {
  describe('ReferenceIndianFoodAdapter', () => {
    const adapter = new ReferenceIndianFoodAdapter();

    it('normalizes valid reference Indian food record with servings and aliases', () => {
      const raw = {
        name: 'Dal Makhani',
        localNames: ['Maa ki Dal'],
        cuisine: 'INDIAN_NORTH',
        nutrients: {
          calories: 140,
          protein: 4.5,
          carbs: 12.0,
          fat: 8.2,
          saturatedFat: 4.8,
          transFat: 0,
          fiber: 3.8,
          sugar: 1.5,
          sodium: 320,
        },
        servings: [{ unitName: 'katori', gramWeight: 200, isDefault: true }],
        aliases: [{ alias: 'Maa ki Dal', language: 'hi', isPrimary: true }],
      };

      const normalized = adapter.normalizeRecord(raw);
      expect(normalized.name).toBe('Dal Makhani');
      expect(normalized.source).toBe(FoodSource.INDIAN_FCT_NIN);
      expect(normalized.nutrients.calories).toBe(140);
      expect(normalized.nutrients.saturatedFat).toBe(4.8);
      expect(normalized.servings).toHaveLength(1);
      expect(normalized.servings[0]?.gramWeight).toBe(200);

      const validation = adapter.validateRecord(normalized);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('rejects invalid records with negative nutrients or non-finite values', () => {
      const raw = {
        name: 'Invalid Dal',
        nutrients: {
          calories: -50,
          protein: NaN,
          carbs: 20,
          fat: -2,
        },
      };

      const normalized = adapter.normalizeRecord(raw);
      const validation = adapter.validateRecord(normalized);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('UsdaFoodDataAdapter', () => {
    const adapter = new UsdaFoodDataAdapter();

    it('normalizes USDA FoodData Central raw item format', () => {
      const rawUsda = {
        fdcId: 171058,
        description: 'Chicken, breast, meat only, cooked, roasted',
        foodNutrients: [
          { nutrientNumber: '208', value: 165, unitName: 'KCAL' },
          { nutrientNumber: '203', value: 31.0, unitName: 'G' },
          { nutrientNumber: '204', value: 3.6, unitName: 'G' },
          { nutrientNumber: '205', value: 0.0, unitName: 'G' },
          { nutrientNumber: '606', value: 1.0, unitName: 'G' },
          { nutrientNumber: '307', value: 74, unitName: 'MG' },
        ],
        foodPortions: [{ gramWeight: 172, modifier: '1 breast fillet' }],
      };

      const normalized = adapter.normalizeRecord(rawUsda);
      expect(normalized.name).toBe('Chicken, breast, meat only, cooked, roasted');
      expect(normalized.externalId).toBe('171058');
      expect(normalized.source).toBe(FoodSource.USDA_FOOD_DATA_CENTRAL);
      expect(normalized.nutrients.calories).toBe(165);
      expect(normalized.nutrients.protein).toBe(31.0);
      expect(normalized.nutrients.fat).toBe(3.6);
      expect(normalized.nutrients.carbs).toBe(0.0);
      expect(normalized.nutrients.saturatedFat).toBe(1.0);
      expect(normalized.nutrients.sodium).toBe(74);
      expect(normalized.servings).toHaveLength(1);
      expect(normalized.servings[0]?.gramWeight).toBe(172);

      const validation = adapter.validateRecord(normalized);
      expect(validation.isValid).toBe(true);
    });

    it('rejects raw USDA records missing required fdcId or description', () => {
      expect(() => adapter.normalizeRecord({ description: 'No ID' })).toThrow(
        /must contain fdcId/i,
      );
      expect(() => adapter.normalizeRecord({ fdcId: 12345 })).toThrow(/must contain fdcId/i);
    });
  });

  describe('OpenFoodFactsAdapter', () => {
    const adapter = new OpenFoodFactsAdapter();

    it('normalizes Open Food Facts packaged product and converts sodium from grams to milligrams', () => {
      const rawOff = {
        code: '8901262010053',
        product_name: 'Amul Butter',
        brands: 'Amul',
        serving_quantity: 10,
        serving_size: '10g',
        nutriments: {
          'energy-kcal_100g': 722,
          proteins_100g: 0.6,
          carbohydrates_100g: 0.0,
          fat_100g: 80.0,
          'saturated-fat_100g': 51.0,
          sodium_100g: 0.83, // 0.83 grams = 830 mg
        },
      };

      const normalized = adapter.normalizeRecord(rawOff);
      expect(normalized.name).toBe('Amul Butter');
      expect(normalized.barcode).toBe('8901262010053');
      expect(normalized.source).toBe(FoodSource.OPEN_FOOD_FACTS);
      expect(normalized.nutrients.calories).toBe(722);
      expect(normalized.nutrients.fat).toBe(80.0);
      expect(normalized.nutrients.saturatedFat).toBe(51.0);
      // Sodium conversion verified: 0.83g * 1000 = 830mg
      expect(normalized.nutrients.sodium).toBe(830);
      expect(normalized.servings).toHaveLength(1);
      expect(normalized.servings[0]?.gramWeight).toBe(10);

      const validation = adapter.validateRecord(normalized);
      expect(validation.isValid).toBe(true);
    });

    it('rejects Open Food Facts records missing a barcode', () => {
      const rawOffNoCode = {
        product_name: 'Generic Brand',
        nutriments: { 'energy-kcal_100g': 200 },
      };
      const normalized = adapter.normalizeRecord(rawOffNoCode);
      const validation = adapter.validateRecord(normalized);
      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toMatch(/must have a barcode/i);
    });
  });

  describe('IcmrNinAdapter Licensing Compliance Guard', () => {
    it('blocks unlicensed raw bulk ingestion with explicit legal notification', () => {
      const unlicensedAdapter = new IcmrNinAdapter(false);
      const rawEntry = {
        foodCode: 'A001',
        foodName: 'Wheat flour, whole',
        energyKcal: 320,
        proteinG: 10.6,
        carbohydrateG: 64.2,
        totalFatG: 1.5,
      };

      expect(() => unlicensedAdapter.normalizeRecord(rawEntry)).toThrow(
        /ICMR-NIN dataset ingestion blocked: Bulk ingestion of ICMR-NIN tables requires an authorized institutional licensing partner token/i,
      );
    });

    it('accepts ingestion when an authorized licensing partner token is provided', () => {
      const licensedAdapter = new IcmrNinAdapter(true);
      const rawEntry = {
        foodCode: 'A001',
        foodName: 'Wheat flour, whole',
        energyKcal: 320,
        proteinG: 10.6,
        carbohydrateG: 64.2,
        totalFatG: 1.5,
      };

      const normalized = licensedAdapter.normalizeRecord(rawEntry);
      expect(normalized.name).toBe('Wheat flour, whole');
      expect(normalized.source).toBe(FoodSource.ICMR_NIN_IFCT);
      expect(normalized.externalId).toBe('A001');
      expect(normalized.nutrients.calories).toBe(320);

      const validation = licensedAdapter.validateRecord(normalized);
      expect(validation.isValid).toBe(true);
    });
  });
});
