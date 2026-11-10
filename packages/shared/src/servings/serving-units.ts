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
  if (quantity < 0) {
    return {
      success: false,
      error: 'INVALID_QUANTITY',
      message: `Serving quantity cannot be negative (received: ${quantity}).`,
    };
  }

  const normalizedUnit = unit.trim().toLowerCase();

  // Metric base units
  if (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') {
    return {
      success: true,
      gramWeight: roundTo(quantity, 1),
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

  const totalGrams = roundTo(quantity * match.gramWeight, 1);

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
  if (targetGrams < 0) {
    return {
      success: false,
      error: 'INVALID_QUANTITY',
      message: `Gram weight cannot be negative (received: ${targetGrams}).`,
    };
  }

  const normalizedUnit = targetUnit.trim().toLowerCase();

  if (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') {
    return {
      success: true,
      gramWeight: roundTo(targetGrams, 1),
      unit: 'gram',
      quantity: roundTo(targetGrams, 1),
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

  if (match.gramWeight <= 0) {
    return {
      success: false,
      error: 'UNSUPPORTED_UNIT_FOR_FOOD',
      message: `Invalid conversion factor registered for unit "${targetUnit}".`,
    };
  }

  const quantity = roundTo(targetGrams / match.gramWeight, 2);

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
 * Used for testing and initial seeding, demonstrating food-specific density variations.
 */
export const REFERENCE_SERVING_PROFILES = {
  DAL_TADKA: [
    {
      unit: 'katori',
      gramWeight: 200,
      volumeMl: 200,
      provenance: ServingProvenance.ICMR_NIN_IFCT,
      notes: 'Standard 200ml Indian katori filled with cooked yellow lentil dal.',
    },
    {
      unit: 'bowl',
      gramWeight: 350,
      volumeMl: 350,
      provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
      notes: 'Standard soup/cereal bowl.',
    },
    {
      unit: 'ladle',
      gramWeight: 100,
      volumeMl: 100,
      provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
      notes: 'One standard cooking serving ladle.',
    },
  ],
  ROTI_PHULKA: [
    {
      unit: 'roti',
      gramWeight: 35,
      provenance: ServingProvenance.ICMR_NIN_IFCT,
      notes: 'One medium dry whole-wheat phulka (~15cm diameter).',
    },
    {
      unit: 'piece',
      gramWeight: 35,
      provenance: ServingProvenance.ICMR_NIN_IFCT,
      notes: 'Synonym for one roti.',
    },
  ],
  BHINDI_SABZI_DRY: [
    {
      unit: 'katori',
      gramWeight: 140,
      volumeMl: 200,
      provenance: ServingProvenance.ICMR_NIN_IFCT,
      notes: 'Cooked dry okra sabzi. Lower density than liquid dal.',
    },
    {
      unit: 'tablespoon',
      gramWeight: 25,
      provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
    },
  ],
  LASSI_SWEET: [
    {
      unit: 'glass',
      gramWeight: 280,
      volumeMl: 250,
      provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
      notes: 'Sweetened yogurt drink in standard 250ml glass (density ~1.12 g/ml).',
    },
  ],
  WATER: [
    {
      unit: 'glass',
      gramWeight: 250,
      volumeMl: 250,
      provenance: ServingProvenance.USDA,
      notes: 'Pure water (density exactly 1.00 g/ml).',
    },
  ],
} as const satisfies Record<string, FoodServingConversion[]>;
