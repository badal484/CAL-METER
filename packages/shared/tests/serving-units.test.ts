import { describe, it, expect } from 'vitest';
import {
  convertServingToGrams,
  convertGramsToServing,
  REFERENCE_SERVING_PROFILES,
} from '../src/servings/serving-units.js';
import { ServingProvenance } from '../src/constants/enums.js';
import { FoodServingConversion } from '../src/types/index.js';

describe('Food-Specific Serving Unit Conversions', () => {
  it('converts Dal Tadka katori using specific density (1 katori = 200g)', () => {
    const result = convertServingToGrams(REFERENCE_SERVING_PROFILES.DAL_TADKA, 'katori', 1.5);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.gramWeight).toBe(300); // 1.5 * 200g
      expect(result.provenance).toBe(ServingProvenance.ESTIMATED_HOUSEHOLD);
      expect(result.notes).toContain('Illustrative household estimate');
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
    const result = convertServingToGrams(REFERENCE_SERVING_PROFILES.DAL_TADKA, 'roti', 2);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('UNSUPPORTED_UNIT_FOR_FOOD');
      expect(result.message).toContain('No reliable conversion for unit "roti"');
    }
  });

  it('rejects negative, NaN, and Infinity serving quantity', () => {
    const negResult = convertServingToGrams(REFERENCE_SERVING_PROFILES.DAL_TADKA, 'katori', -1);
    expect(negResult.success).toBe(false);
    if (!negResult.success) {
      expect(negResult.error).toBe('INVALID_QUANTITY');
    }

    const nanResult = convertServingToGrams(REFERENCE_SERVING_PROFILES.DAL_TADKA, 'katori', NaN);
    expect(nanResult.success).toBe(false);
    if (!nanResult.success) {
      expect(nanResult.error).toBe('INVALID_QUANTITY');
    }

    const infResult = convertServingToGrams(
      REFERENCE_SERVING_PROFILES.DAL_TADKA,
      'katori',
      Infinity,
    );
    expect(infResult.success).toBe(false);
    if (!infResult.success) {
      expect(infResult.error).toBe('INVALID_QUANTITY');
    }
  });

  it('rejects invalid or non-positive conversion factor registered for a food', () => {
    const invalidFactorConversions: FoodServingConversion[] = [
      {
        unit: 'bowl',
        gramWeight: 0, // non-positive
        provenance: ServingProvenance.USER_CONFIGURED,
      },
    ];

    const result = convertServingToGrams(invalidFactorConversions, 'bowl', 2);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('INVALID_CONVERSION_FACTOR');
    }

    const nanFactorConversions: FoodServingConversion[] = [
      {
        unit: 'bowl',
        gramWeight: NaN,
        provenance: ServingProvenance.USER_CONFIGURED,
      },
    ];

    const nanResult = convertServingToGrams(nanFactorConversions, 'bowl', 2);
    expect(nanResult.success).toBe(false);
    if (!nanResult.success) {
      expect(nanResult.error).toBe('INVALID_CONVERSION_FACTOR');
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

  it('rejects negative, NaN, and Infinity in convertGramsToServing', () => {
    expect(
      convertGramsToServing(REFERENCE_SERVING_PROFILES.DAL_TADKA, -100, 'katori').success,
    ).toBe(false);
    expect(convertGramsToServing(REFERENCE_SERVING_PROFILES.DAL_TADKA, NaN, 'katori').success).toBe(
      false,
    );
    expect(
      convertGramsToServing(REFERENCE_SERVING_PROFILES.DAL_TADKA, Infinity, 'katori').success,
    ).toBe(false);
  });

  describe('Serving Conversion Overflow Prevention', () => {
    it('rejects multiplication overflow when quantity * gramWeight overflows to Infinity', () => {
      // 1e308 is finite, but 1e308 * 200g (Dal Tadka katori) = Infinity
      const result = convertServingToGrams(REFERENCE_SERVING_PROFILES.DAL_TADKA, 'katori', 1e308);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('CONVERSION_OVERFLOW');
        expect(result.message).toContain('numeric overflow');
      }
    });

    it('rejects division overflow in convertGramsToServing when targetGrams / gramWeight overflows', () => {
      const tinyWeightConversion: FoodServingConversion[] = [
        {
          unit: 'pinch',
          gramWeight: 1e-10, // Very small finite weight
          provenance: ServingProvenance.USER_CONFIGURED,
        },
      ];

      // 1e300 / 1e-10 = 1e310 -> Infinity
      const result = convertGramsToServing(tinyWeightConversion, 1e300, 'pinch');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('CONVERSION_OVERFLOW');
        expect(result.message).toContain('numeric overflow');
      }
    });
  });

  it('verifies reference serving profiles do not use unverified ICMR provenance and have valid provenance', () => {
    Object.values(REFERENCE_SERVING_PROFILES).forEach(profileList => {
      profileList.forEach(conv => {
        expect(conv.provenance).not.toBe(ServingProvenance.ICMR_NIN_IFCT);
        expect(
          conv.provenance === ServingProvenance.ESTIMATED_HOUSEHOLD ||
            conv.provenance === ServingProvenance.USDA,
        ).toBe(true);
        expect(conv.notes).toBeDefined();
        expect(conv.gramWeight).toBeGreaterThan(0);
      });
    });
  });
});
