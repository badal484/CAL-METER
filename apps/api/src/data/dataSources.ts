import { FoodSource } from '@calmeter/shared';

export interface FoodDataSourceDef {
  source: FoodSource;
  name: string;
  license: string;
  licenseUrl?: string;
  attribution: string;
  description: string;
}

export const INITIAL_FOOD_DATA_SOURCES: FoodDataSourceDef[] = [
  {
    source: FoodSource.INDIAN_FCT_NIN,
    name: 'Indian Culinary & Reference Food Composition Tables',
    license: 'Government of India Reference / Culinary Standard Guidelines',
    attribution:
      'Standard culinary recipe formulations and nutrient reference data based on ICMR-NIN Indian Food Composition Tables guidelines.',
    description:
      'High-confidence reference nutrient profiles for authentic Indian regional home-cooked dishes, restaurant preparations, and traditional staples.',
  },
  {
    source: FoodSource.USDA_FOOD_DATA_CENTRAL,
    name: 'USDA FoodData Central',
    license: 'US Public Domain / CC0 1.0 Universal',
    licenseUrl: 'https://fdc.nal.usda.gov',
    attribution:
      'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2024.',
    description:
      'Comprehensive USDA foundation and legacy food nutrient datasets covering global agricultural commodities, whole foods, and baseline ingredients.',
  },
  {
    source: FoodSource.OPEN_FOOD_FACTS,
    name: 'Open Food Facts',
    license: 'Open Database License (ODbL) v1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1.0/',
    attribution: 'Data sourced from Open Food Facts (ODbL 1.0) community contributors.',
    description:
      'Collaborative international database of packaged and branded consumer food products with Global Trade Item Numbers (GTIN/EAN barcodes).',
  },
  {
    source: FoodSource.VERIFIED_COMMUNITY,
    name: 'CAL METER Verified Community Database',
    license: 'CAL METER Community Data License',
    attribution: 'Verified by CAL METER certified clinical dietitians and nutritionists.',
    description:
      'Dietitian-reviewed and lab-calibrated nutrient profiles for complex composite meals, regional restaurant specialties, and verified household recipes.',
  },
  {
    source: FoodSource.CUSTOM_USER,
    name: 'User Created Custom Foods',
    license: 'Proprietary User Submission (Private)',
    attribution: 'Private food item created by authenticated user.',
    description:
      'Privately stored food records created by individual users for personal calorie and macronutrient logging.',
  },
];
