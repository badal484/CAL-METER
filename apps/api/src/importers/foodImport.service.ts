import { PrismaClient, type Prisma, FoodSource as PrismaFoodSource } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  IFoodSourceAdapter,
  ImportOptions,
  ImportSummary,
  ImportErrorRecord,
  NormalizedFoodRecord,
} from './types.js';

function toPrismaFoodSource(source: string): PrismaFoodSource {
  if (source === 'ICMR_NIN_IFCT') {
    return PrismaFoodSource.INDIAN_FCT_NIN;
  }
  return source as PrismaFoodSource;
}

export class FoodImportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Imports a batch of raw records through a source adapter with validation,
   * duplicate detection, provenance preservation, and dry-run support.
   */
  async importRecords(
    adapter: IFoodSourceAdapter,
    rawRecords: unknown[],
    options: ImportOptions = {},
  ): Promise<ImportSummary> {
    const isDryRun = Boolean(options.dryRun);
    const allowOverwriteVerified = Boolean(options.allowOverwriteVerified);
    const startedAt = new Date();
    const prismaSource = toPrismaFoodSource(adapter.source);
    const batchNumber =
      options.batchNumber || `BATCH-${adapter.source}-${Date.now()}-${randomUUID().slice(0, 8)}`;

    const errors: ImportErrorRecord[] = [];
    let importedRecords = 0;
    let skippedRecords = 0;
    let failedRecords = 0;

    // Ensure data source record exists in database
    let dataSource = await this.prisma.foodDataSource.findUnique({
      where: { source: prismaSource },
    });

    if (!dataSource && !isDryRun) {
      dataSource = await this.prisma.foodDataSource.create({
        data: {
          source: prismaSource,
          name: adapter.sourceName,
          license: adapter.license,
          attribution: adapter.attribution,
          description: `Ingestion source adapter for ${adapter.sourceName}`,
        },
      });
    }

    // Create or update batch tracking entry idempotently
    let batchId: string | undefined;
    if (!isDryRun) {
      const batch = await this.prisma.foodImportBatch.upsert({
        where: { batchNumber },
        create: {
          source: prismaSource,
          batchNumber,
          status: 'RUNNING',
          totalRecords: rawRecords.length,
          startedAt,
        },
        update: {
          status: 'RUNNING',
          totalRecords: rawRecords.length,
          startedAt,
        },
      });
      batchId = batch.id;
    }

    // Pre-cache categories for fast slug lookup
    const categories = await this.prisma.foodCategory.findMany();
    const categoryMap = new Map<string, string>();
    for (const cat of categories) {
      categoryMap.set(cat.slug.toLowerCase(), cat.id);
    }

    for (let i = 0; i < rawRecords.length; i++) {
      const raw = rawRecords[i];
      let normalized: NormalizedFoodRecord;

      try {
        normalized = adapter.normalizeRecord(raw);
      } catch (err: unknown) {
        failedRecords++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ recordIndex: i, message: `Normalization error: ${msg}` });
        continue;
      }

      const validation = adapter.validateRecord(normalized);
      if (!validation.isValid) {
        failedRecords++;
        errors.push({
          recordIndex: i,
          identifier: normalized.name || normalized.externalId,
          message: `Validation failed: ${validation.errors.join('; ')}`,
        });
        continue;
      }

      try {
        if (isDryRun) {
          // Dry-run mode: check duplicates and simulate without modifying database
          const existing = await this.findExistingFood(normalized);
          if (existing) {
            if (existing.isCustom || existing.createdByUserId) {
              skippedRecords++;
              continue; // Never touch user custom foods
            }
            if (existing.isVerified && !allowOverwriteVerified) {
              skippedRecords++;
              continue;
            }
          }
          importedRecords++;
        } else {
          // Live execution: upsert within transaction
          await this.persistFoodRecord(
            normalized,
            categoryMap,
            dataSource?.id,
            batchId,
            allowOverwriteVerified,
          );
          importedRecords++;
        }
      } catch (err: unknown) {
        failedRecords++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({
          recordIndex: i,
          identifier: normalized.name || normalized.externalId,
          message: `Persistence error: ${msg}`,
        });
      }
    }

    const completedAt = new Date();
    const finalStatus = isDryRun
      ? 'DRY_RUN'
      : errors.length > 0 && importedRecords === 0
        ? 'FAILED'
        : 'COMPLETED';

    if (!isDryRun && batchId) {
      await this.prisma.foodImportBatch.update({
        where: { id: batchId },
        data: {
          status: finalStatus,
          importedRecords,
          skippedRecords,
          failedRecords,
          completedAt,
          errorLog: errors.slice(0, 100) as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return {
      batchId,
      batchNumber,
      source: adapter.source,
      status: finalStatus,
      isDryRun,
      totalRecords: rawRecords.length,
      importedRecords,
      skippedRecords,
      failedRecords,
      errors,
      startedAt,
      completedAt,
    };
  }

  /**
   * Duplicate detection: checks barcode, externalId + source, or normalized name + brand.
   */
  private async findExistingFood(record: NormalizedFoodRecord) {
    const prismaSource = toPrismaFoodSource(record.source);

    if (record.barcode) {
      const byBarcode = await this.prisma.foodItem.findUnique({
        where: { barcode: record.barcode },
      });
      if (byBarcode) return byBarcode;
    }

    if (record.externalId) {
      const byExternalId = await this.prisma.foodItem.findFirst({
        where: {
          source: prismaSource,
          externalId: record.externalId,
        },
      });
      if (byExternalId) return byExternalId;
    }

    // Name + source match
    return this.prisma.foodItem.findFirst({
      where: {
        source: prismaSource,
        name: { equals: record.name, mode: 'insensitive' },
        brand: record.brand ? { equals: record.brand, mode: 'insensitive' } : null,
      },
    });
  }

  /**
   * Persists normalized food, nutrient profile, serving conversions, and aliases.
   */
  private async persistFoodRecord(
    record: NormalizedFoodRecord,
    categoryMap: Map<string, string>,
    dataSourceId: string | undefined,
    batchId: string | undefined,
    allowOverwriteVerified: boolean,
  ): Promise<void> {
    const existing = await this.findExistingFood(record);
    const prismaSource = toPrismaFoodSource(record.source);

    if (existing) {
      // Rule: Never overwrite user-created custom foods
      if (existing.isCustom || existing.createdByUserId) {
        return;
      }
      // Rule: Do not overwrite manually verified records unless explicitly allowed
      if (existing.isVerified && !allowOverwriteVerified) {
        return;
      }
    }

    const categoryId = record.categorySlug
      ? categoryMap.get(record.categorySlug.toLowerCase())
      : undefined;

    await this.prisma.$transaction(async tx => {
      let foodId = existing?.id;

      if (existing) {
        await tx.foodItem.update({
          where: { id: existing.id },
          data: {
            name: record.name,
            localNames: record.localNames || [],
            brand: record.brand,
            barcode: record.barcode,
            cuisine: record.cuisine,
            state: record.state,
            prepMethod: record.prepMethod,
            servingSize: record.servingSize,
            servingUnit: record.servingUnit,
            standardWeightGrams: record.standardWeightGrams,
            calories: record.nutrients.calories,
            protein: record.nutrients.protein,
            carbs: record.nutrients.carbs,
            fat: record.nutrients.fat,
            fiber: record.nutrients.fiber ?? 0,
            confidenceScore: record.confidenceScore,
            isVerified: record.isVerified ?? true,
            categoryId: categoryId || existing.categoryId,
            dataSourceId: dataSourceId || existing.dataSourceId,
            importBatchId: batchId || existing.importBatchId,
          },
        });
      } else {
        const created = await tx.foodItem.create({
          data: {
            name: record.name,
            localNames: record.localNames || [],
            brand: record.brand,
            barcode: record.barcode,
            source: prismaSource,
            externalId: record.externalId,
            cuisine: record.cuisine,
            state: record.state,
            prepMethod: record.prepMethod,
            isCustom: false,
            isVerified: record.isVerified ?? true,
            confidenceScore: record.confidenceScore,
            servingSize: record.servingSize,
            servingUnit: record.servingUnit,
            standardWeightGrams: record.standardWeightGrams,
            calories: record.nutrients.calories,
            protein: record.nutrients.protein,
            carbs: record.nutrients.carbs,
            fat: record.nutrients.fat,
            fiber: record.nutrients.fiber ?? 0,
            categoryId,
            dataSourceId,
            importBatchId: batchId,
          },
        });
        foodId = created.id;
      }

      if (!foodId) return;

      // Upsert nutrient profile (preserving nulls vs zeros)
      await tx.foodNutrientProfile.upsert({
        where: { foodItemId: foodId },
        create: {
          foodItemId: foodId,
          calories: record.nutrients.calories,
          protein: record.nutrients.protein,
          carbs: record.nutrients.carbs,
          fat: record.nutrients.fat,
          saturatedFat: record.nutrients.saturatedFat,
          transFat: record.nutrients.transFat,
          fiber: record.nutrients.fiber,
          sugar: record.nutrients.sugar,
          addedSugar: record.nutrients.addedSugar,
          sodium: record.nutrients.sodium,
          cholesterol: record.nutrients.cholesterol,
          potassium: record.nutrients.potassium,
          calcium: record.nutrients.calcium,
          iron: record.nutrients.iron,
          vitaminD: record.nutrients.vitaminD,
          vitaminB12: record.nutrients.vitaminB12,
          micronutrients: (record.nutrients.micronutrients || {}) as Prisma.InputJsonValue,
        },
        update: {
          calories: record.nutrients.calories,
          protein: record.nutrients.protein,
          carbs: record.nutrients.carbs,
          fat: record.nutrients.fat,
          saturatedFat: record.nutrients.saturatedFat,
          transFat: record.nutrients.transFat,
          fiber: record.nutrients.fiber,
          sugar: record.nutrients.sugar,
          addedSugar: record.nutrients.addedSugar,
          sodium: record.nutrients.sodium,
          cholesterol: record.nutrients.cholesterol,
          potassium: record.nutrients.potassium,
          calcium: record.nutrients.calcium,
          iron: record.nutrients.iron,
          vitaminD: record.nutrients.vitaminD,
          vitaminB12: record.nutrients.vitaminB12,
          micronutrients: (record.nutrients.micronutrients || {}) as Prisma.InputJsonValue,
        },
      });

      // Serving conversions
      for (const s of record.servings) {
        await tx.servingUnitConversion.upsert({
          where: {
            foodItemId_unitName: {
              foodItemId: foodId,
              unitName: s.unitName,
            },
          },
          create: {
            foodItemId: foodId,
            unitName: s.unitName,
            servingDescription: s.servingDescription,
            gramWeight: s.gramWeight,
            mlVolume: s.mlVolume,
            provenance: s.provenance || 'USER_CONFIGURED',
            isDefault: Boolean(s.isDefault),
          },
          update: {
            servingDescription: s.servingDescription,
            gramWeight: s.gramWeight,
            mlVolume: s.mlVolume,
            provenance: s.provenance || 'USER_CONFIGURED',
            isDefault: Boolean(s.isDefault),
          },
        });
      }

      // Aliases
      for (const a of record.aliases) {
        await tx.foodAlias.upsert({
          where: {
            foodItemId_alias: {
              foodItemId: foodId,
              alias: a.alias,
            },
          },
          create: {
            foodItemId: foodId,
            alias: a.alias,
            language: a.language,
            isPrimary: Boolean(a.isPrimary),
          },
          update: {
            language: a.language,
            isPrimary: Boolean(a.isPrimary),
          },
        });
      }

      // Recipe ingredients if present
      if (record.ingredients && record.ingredients.length > 0) {
        await tx.foodIngredient.deleteMany({
          where: { parentFoodItemId: foodId },
        });

        for (const ing of record.ingredients) {
          await tx.foodIngredient.create({
            data: {
              parentFoodItemId: foodId,
              ingredientName: ing.ingredientName,
              gramWeight: ing.gramWeight,
              notes: ing.notes,
              orderIndex: ing.orderIndex || 0,
            },
          });
        }
      }
    });
  }
}
