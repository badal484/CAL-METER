import { describe, it, expect } from 'vitest';
import {
  convertServingToGrams,
  convertGramsToServing,
  REFERENCE_SERVING_PROFILES,
} from '../src/servings/serving-units.js';
import { ServingProvenance } from '../src/constants/enums.js';

describe('Food-Specific Serving Unit Conversions', () => {
  it('converts Dal Tadka katori using specific density (1 katori = 200g)', () => {
    const result = convertServingToGrams(REFERENCE_SERVING_PROFILES.DAL_TADKA, 'katori', 1.5);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.gramWeight).toBe(300); // 1.5 * 200g
      expect(result.provenance).toBe(ServingProvenance.ICMR_NIN_IFCT);
    }
  });

  it('demonstrates that katori density is food-specific (Bhindi Sabzi katori = 140g != Dal 200g)', () => {
    const dalResult = convertServingToGrams(REFERENCE_SERVING_PROFILES.DAL_TADKA, 'katori', 1);
    const bhindiResult = convertServingToGrams(
      REFERENCE_SERVING_PROFILES.BHINDI_SABZI_DRY,
      'katori',
      1,
    );

    expect(dalResult.success).toBe(true);
    expect(bhindiResult.success).toBe(true);
    if (dalResult.success && bhindiResult.success) {
      expect(dalResult.gramWeight).toBe(200);
      expect(bhindiResult.gramWeight).toBe(140);
      expect(dalResult.gramWeight).not.toBe(bhindiResult.gramWeight);
    }
  });

  it('converts Roti Phulka pieces accurately (1 roti = 35g)', () => {
    const result = convertServingToGrams(REFERENCE_SERVING_PROFILES.ROTI_PHULKA, 'roti', 3);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.gramWeight).toBe(105); // 3 * 35g
    }
  });

  it('passes standard metric grams directly through', () => {
    const result = convertServingToGrams(REFERENCE_SERVING_PROFILES.DAL_TADKA, 'grams', 175);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.gramWeight).toBe(175);
    }
  });

  it('returns explicit unsupported error when a unit is not registered for that food', () => {
    // Attempting to ask for "roti" of Dal Tadka
    const result = convertServingToGrams(REFERENCE_SERVING_PROFILES.DAL_TADKA, 'roti', 2);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('UNSUPPORTED_UNIT_FOR_FOOD');
      expect(result.message).toContain('No reliable conversion for unit "roti"');
    }
  });

  it('rejects negative serving quantity', () => {
    const result = convertServingToGrams(REFERENCE_SERVING_PROFILES.DAL_TADKA, 'katori', -1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('INVALID_QUANTITY');
    }
  });

  it('converts known grams back into household servings (convertGramsToServing)', () => {
    // 300g of Dal Tadka should convert to 1.5 katori
    const result = convertGramsToServing(REFERENCE_SERVING_PROFILES.DAL_TADKA, 300, 'katori');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.quantity).toBe(1.5);
      expect(result.unit).toBe('katori');
    }
  });

  it('converts known grams back to roti count', () => {
    // 70g of Roti should convert to 2 rotis (35g each)
    const result = convertGramsToServing(REFERENCE_SERVING_PROFILES.ROTI_PHULKA, 70, 'roti');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.quantity).toBe(2);
    }
  });
});
