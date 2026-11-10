import { ServingProvenance } from '../constants/enums.js';
import { FoodServingConversion, ServingConversionResult } from '../types/index.js';
import { roundTo } from '../utils/measurements.js';

/**
 * Standard household serving unit identifiers supported in CAL METER.
 */
export const SUPPORTED_HOUSEHOLD_UNITS = [
  'katori',
  'roti',
  'bowl',
  'ladle',
  'glass',
  'piece',
  'cup',
  'tablespoon',
  'teaspoon',
  'gram',
  'ml',
] as const;

export type SupportedHouseholdUnit = (typeof SUPPORTED_HOUSEHOLD_UNITS)[number];

/**
 * Converts a serving quantity and unit into gram weight using food-specific conversions.
 *
 * Health & Safety / Engineering Principle:
 * Never assume all foods share the same volumetric density.
 * A katori of liquid dal is ~200g, while a katori of dry leafy sabzi is ~120-150g,
 * and a katori of puffed rice is ~40g. A conversion must be provided for the specific food,
 * or an explicit unsupported result is returned.
 */
export function convertServingToGrams(
  foodSpecificConversions: FoodServingConversion[],
  unit: string,
  quantity: number,
): ServingConversionResult {
  if (!Number.isFinite(quantity) || quantity < 0) {
    return {
      success: false,
      error: 'INVALID_QUANTITY',
      message: `Serving quantity must be a non-negative finite number (received: ${quantity}).`,
    };
  }

  const normalizedUnit = unit.trim().toLowerCase();

  // Metric base units
  if (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') {
    const rounded = roundTo(quantity, 1);
    if (!Number.isFinite(rounded)) {
      return {
        success: false,
        error: 'CONVERSION_OVERFLOW',
        message: `Serving quantity in grams resulted in non-finite value.`,
      };
    }
    return {
      success: true,
      gramWeight: rounded,
      unit: 'gram',
      quantity,
      provenance: ServingProvenance.USER_CONFIGURED,
    };
  }

  // Look up food-specific conversion
  const match = foodSpecificConversions.find(c => c.unit.trim().toLowerCase() === normalizedUnit);

  if (!match) {
    return {
      success: false,
      error: 'UNSUPPORTED_UNIT_FOR_FOOD',
      message: `No reliable conversion for unit "${unit}" is registered for this food item. Please specify quantity in grams.`,
    };
  }

  if (!Number.isFinite(match.gramWeight) || match.gramWeight <= 0) {
    return {
      success: false,
      error: 'INVALID_CONVERSION_FACTOR',
      message: `Invalid conversion factor registered for unit "${unit}". Gram weight must be a positive finite number (found: ${match.gramWeight}).`,
    };
  }

  const rawGrams = quantity * match.gramWeight;
  if (!Number.isFinite(rawGrams)) {
    return {
      success: false,
      error: 'CONVERSION_OVERFLOW',
      message: `Serving conversion resulted in numeric overflow for unit "${unit}" (result: ${rawGrams}).`,
    };
  }

  const totalGrams = roundTo(rawGrams, 1);
  if (!Number.isFinite(totalGrams)) {
    return {
      success: false,
      error: 'CONVERSION_OVERFLOW',
      message: `Serving conversion resulted in numeric overflow for unit "${unit}" after rounding.`,
    };
  }

  return {
    success: true,
    gramWeight: totalGrams,
    unit: match.unit,
    quantity,
    provenance: match.provenance,
    notes: match.notes,
  };
}

/**
 * Converts a known gram weight back into a specific household serving unit
 * using food-specific conversion factors.
 */
export function convertGramsToServing(
  foodSpecificConversions: FoodServingConversion[],
  targetGrams: number,
  targetUnit: string,
): ServingConversionResult {
  if (!Number.isFinite(targetGrams) || targetGrams < 0) {
    return {
      success: false,
      error: 'INVALID_QUANTITY',
      message: `Gram weight must be a non-negative finite number (received: ${targetGrams}).`,
    };
  }

  const normalizedUnit = targetUnit.trim().toLowerCase();

  if (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') {
    const rounded = roundTo(targetGrams, 1);
    if (!Number.isFinite(rounded)) {
      return {
        success: false,
        error: 'CONVERSION_OVERFLOW',
        message: `Target grams resulted in non-finite value.`,
      };
    }
    return {
      success: true,
      gramWeight: rounded,
      unit: 'gram',
      quantity: rounded,
      provenance: ServingProvenance.USER_CONFIGURED,
    };
  }

  const match = foodSpecificConversions.find(c => c.unit.trim().toLowerCase() === normalizedUnit);

  if (!match) {
    return {
      success: false,
      error: 'UNSUPPORTED_UNIT_FOR_FOOD',
      message: `No reliable conversion for unit "${targetUnit}" is registered for this food item.`,
    };
  }

  if (!Number.isFinite(match.gramWeight) || match.gramWeight <= 0) {
    return {
      success: false,
      error: 'INVALID_CONVERSION_FACTOR',
      message: `Invalid conversion factor registered for unit "${targetUnit}".`,
    };
  }

  const rawQuantity = targetGrams / match.gramWeight;
  if (!Number.isFinite(rawQuantity)) {
    return {
      success: false,
      error: 'CONVERSION_OVERFLOW',
      message: `Gram to serving conversion resulted in numeric overflow for unit "${targetUnit}" (result: ${rawQuantity}).`,
    };
  }

  const quantity = roundTo(rawQuantity, 2);
  if (!Number.isFinite(quantity)) {
    return {
      success: false,
      error: 'CONVERSION_OVERFLOW',
      message: `Gram to serving conversion resulted in numeric overflow for unit "${targetUnit}" after rounding.`,
    };
  }

  return {
    success: true,
    gramWeight: targetGrams,
    unit: match.unit,
    quantity,
    provenance: match.provenance,
    notes: match.notes,
  };
}

/**
 * Reference conversion profiles for representative regional foods.
 *
 * PROVENANCE & LICENSING COMPLIANCE:
 * These conversions are illustrative household estimates for common culinary preparations.
 * They are NOT certified or authoritative biochemical data from ICMR-NIN/IFCT or government sources.
 * Provenance is marked explicitly as ESTIMATED_HOUSEHOLD.
 */
export const REFERENCE_SERVING_PROFILES = {
  DAL_TADKA: [
    {
      unit: 'katori',
      gramWeight: 200,
      volumeMl: 200,
      provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
      notes:
        'Illustrative household estimate: Standard ~200ml Indian katori filled with cooked yellow lentil dal (density ~1.0 g/ml).',
    },
    {
      unit: 'bowl',
      gramWeight: 350,
      volumeMl: 350,
      provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
      notes: 'Illustrative household estimate: Standard soup/cereal bowl.',
    },
    {
      unit: 'ladle',
      gramWeight: 100,
      volumeMl: 100,
      provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
      notes: 'Illustrative household estimate: One standard cooking serving ladle.',
    },
  ],
  ROTI_PHULKA: [
    {
      unit: 'roti',
      gramWeight: 35,
      provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
      notes:
        'Illustrative household estimate: One medium dry whole-wheat phulka (~15cm diameter, 30-40g).',
    },
    {
      unit: 'piece',
      gramWeight: 35,
      provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
      notes: 'Illustrative synonym for one roti.',
    },
  ],
  BHINDI_SABZI_DRY: [
    {
      unit: 'katori',
      gramWeight: 140,
      volumeMl: 200,
      provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
      notes:
        'Illustrative household estimate: Cooked dry okra sabzi. Notice lower volumetric density than liquid dal.',
    },
    {
      unit: 'tablespoon',
      gramWeight: 25,
      provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
      notes: 'Illustrative household estimate: Level tablespoon of dry sabzi.',
    },
  ],
  LASSI_SWEET: [
    {
      unit: 'glass',
      gramWeight: 280,
      volumeMl: 250,
      provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
      notes:
        'Illustrative household estimate: Sweetened yogurt beverage in standard 250ml glass (estimated density ~1.12 g/ml).',
    },
  ],
  WATER: [
    {
      unit: 'glass',
      gramWeight: 250,
      volumeMl: 250,
      provenance: ServingProvenance.USDA,
      notes:
        'Reference measurement: Pure water in standard 250ml glass (density exactly 1.00 g/ml).',
    },
  ],
} as const satisfies Record<string, FoodServingConversion[]>;
