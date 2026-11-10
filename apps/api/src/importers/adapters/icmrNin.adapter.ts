import { FoodSource } from '@calmeter/shared';
import type { IFoodSourceAdapter, NormalizedFoodRecord } from '../types.js';

export interface IcmrNinRawFoodEntry {
  foodCode: string;
  foodName: string;
  scientificName?: string;
  groupName?: string;
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  totalFatG: number;
  dietaryFiberG?: number;
  freeSugarsG?: number;
  sodiumMg?: number;
  calciumMg?: number;
  ironMg?: number;
  potassiumMg?: number;
  thiamineMg?: number;
  riboflavinMg?: number;
  niacinMg?: number;
  vitaminCMg?: number;
  licensingPartnerToken?: string;
}

/**
 * ICMR-NIN Indian Food Composition Tables (IFCT) Adapter.
 *
 * Licensing and Legal Notice:
 * The Indian Food Composition Tables (IFCT 2017) are published by the National Institute of Nutrition
 * (Indian Council of Medical Research), Hyderabad, Government of India.
 * Copyright is owned by ICMR-NIN.
 *
 * The complete digital database is NOT distributed under an open public license (such as CC0 or ODbL).
 * Commercial digital redistribution of the full ICMR-NIN database dump requires an explicit institutional
 * data agreement or license from ICMR-NIN.
 *
 * This adapter provides the compliant ingestion boundary when an authorized data feed or licensed partner
 * token is present. Unlicensed bulk imports are blocked with a clear licensing exception.
 */
export class IcmrNinAdapter implements IFoodSourceAdapter {
  readonly source = FoodSource.ICMR_NIN_IFCT;
  readonly sourceName = 'ICMR-NIN Indian Food Composition Tables';
  readonly license =
    'Government of India Copyright (ICMR-NIN 2017) — Authorized Partner Ingestion Only';
  readonly attribution =
    'Longvah, T., et al. (2017). Indian Food Composition Tables. National Institute of Nutrition, ICMR, Hyderabad.';

  private readonly hasInstitutionalLicense: boolean;

  constructor(hasInstitutionalLicense = false) {
    this.hasInstitutionalLicense = hasInstitutionalLicense;
  }

  normalizeRecord(raw: unknown): NormalizedFoodRecord {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Raw ICMR-NIN record must be a non-null object.');
    }
    const item = raw as IcmrNinRawFoodEntry;

    // Legal compliance guard
    if (!this.hasInstitutionalLicense && !item.licensingPartnerToken) {
      throw new Error(
        'ICMR-NIN dataset ingestion blocked: Bulk ingestion of ICMR-NIN tables requires an authorized institutional licensing partner token. For standard Indian dishes, use ReferenceIndianFoodAdapter.',
      );
    }

    const name = (item.foodName || '').trim();
    if (!name) {
      throw new Error('ICMR-NIN food record must have a valid foodName.');
    }

    return {
      name,
      source: this.source,
      externalId: String(item.foodCode || '').trim(),
      cuisine: 'INDIAN_NORTH',
      categorySlug: 'grains-and-breads',
      state: 'RAW',
      servingSize: 100,
      servingUnit: 'g',
      standardWeightGrams: 100,
      confidenceScore: 0.99,
      isVerified: true,
      nutrients: {
        calories: Number(item.energyKcal ?? 0),
        protein: Number(item.proteinG ?? 0),
        carbs: Number(item.carbohydrateG ?? 0),
        fat: Number(item.totalFatG ?? 0),
        fiber: item.dietaryFiberG !== undefined ? Number(item.dietaryFiberG) : null,
        sugar: item.freeSugarsG !== undefined ? Number(item.freeSugarsG) : null,
        sodium: item.sodiumMg !== undefined ? Number(item.sodiumMg) : null,
        calcium: item.calciumMg !== undefined ? Number(item.calciumMg) : null,
        iron: item.ironMg !== undefined ? Number(item.ironMg) : null,
        potassium: item.potassiumMg !== undefined ? Number(item.potassiumMg) : null,
        micronutrients: {},
      },
      servings: [
        {
          unitName: 'gram',
          servingDescription: '100 grams raw',
          gramWeight: 100,
          provenance: 'ICMR_NIN_IFCT',
          isDefault: true,
        },
      ],
      aliases: item.scientificName
        ? [{ alias: item.scientificName, language: 'latin', isPrimary: false }]
        : [],
    };
  }

  validateRecord(normalized: NormalizedFoodRecord): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!normalized.name) {
      errors.push('ICMR-NIN food name cannot be empty.');
    }
    if (!normalized.externalId) {
      errors.push('ICMR-NIN food code (externalId) is required.');
    }
    if (!Number.isFinite(normalized.nutrients.calories) || normalized.nutrients.calories < 0) {
      errors.push('Calories must be a non-negative finite number.');
    }
    return { isValid: errors.length === 0, errors };
  }
}
