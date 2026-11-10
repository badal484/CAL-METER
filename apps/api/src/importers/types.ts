import { FoodSource } from '@calmeter/shared';

export type ImportStatusType = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'DRY_RUN';

export interface NormalizedServing {
  unitName: string;
  servingDescription?: string;
  gramWeight: number;
  mlVolume?: number;
  provenance?: string;
  isDefault?: boolean;
}

export interface NormalizedAlias {
  alias: string;
  language?: string;
  isPrimary?: boolean;
}

export interface NormalizedIngredient {
  ingredientName: string;
  gramWeight?: number;
  notes?: string;
  orderIndex?: number;
}

export interface NormalizedNutrientProfile {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturatedFat?: number | null;
  transFat?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  addedSugar?: number | null;
  sodium?: number | null; // mg
  cholesterol?: number | null; // mg
  potassium?: number | null; // mg
  calcium?: number | null; // mg
  iron?: number | null; // mg
  vitaminD?: number | null; // mcg
  vitaminB12?: number | null; // mcg
  micronutrients?: Record<string, number>;
}

export interface NormalizedFoodRecord {
  name: string;
  localNames?: string[];
  brand?: string;
  barcode?: string;
  source: FoodSource;
  externalId?: string;
  cuisine?: string;
  categorySlug?: string;
  state?: 'RAW' | 'COOKED' | 'PREPARED';
  prepMethod?: string;
  servingSize: number;
  servingUnit: string;
  standardWeightGrams: number;
  confidenceScore?: number;
  isVerified?: boolean;
  nutrients: NormalizedNutrientProfile;
  servings: NormalizedServing[];
  aliases: NormalizedAlias[];
  ingredients?: NormalizedIngredient[];
}

export interface IFoodSourceAdapter {
  readonly source: FoodSource;
  readonly sourceName: string;
  readonly license: string;
  readonly attribution?: string;

  normalizeRecord(raw: unknown): NormalizedFoodRecord;
  validateRecord(normalized: NormalizedFoodRecord): { isValid: boolean; errors: string[] };
}

export interface ImportOptions {
  dryRun?: boolean;
  allowOverwriteVerified?: boolean;
  batchNumber?: string;
}

export interface ImportErrorRecord {
  recordIndex: number;
  identifier?: string;
  message: string;
}

export interface ImportSummary {
  batchId?: string;
  batchNumber: string;
  source: FoodSource;
  status: ImportStatusType;
  isDryRun: boolean;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  failedRecords: number;
  errors: ImportErrorRecord[];
  startedAt: Date;
  completedAt: Date;
}
