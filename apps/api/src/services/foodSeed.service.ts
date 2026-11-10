import { PrismaClient, FoodSource as PrismaFoodSource } from '@prisma/client';
import { INITIAL_FOOD_CATEGORIES } from '../data/categories.js';
import { INITIAL_FOOD_DATA_SOURCES } from '../data/dataSources.js';
import { SEED_FOODS } from '../data/seedFoods.js';
import { ReferenceIndianFoodAdapter } from '../importers/adapters/referenceIndianFood.adapter.js';
import { FoodImportService } from '../importers/foodImport.service.js';

export async function seedFoodDatabase(prisma: PrismaClient): Promise<{
  categoriesCount: number;
  dataSourcesCount: number;
  foodsImported: number;
}> {
  // 1. Seed Categories
  for (const cat of INITIAL_FOOD_CATEGORIES) {
    await prisma.foodCategory.upsert({
      where: { slug: cat.slug },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
      },
      update: {
        name: cat.name,
        description: cat.description,
      },
    });
  }

  // 2. Seed Data Sources
  for (const ds of INITIAL_FOOD_DATA_SOURCES) {
    const prismaSource =
      ds.source === 'ICMR_NIN_IFCT'
        ? PrismaFoodSource.INDIAN_FCT_NIN
        : (ds.source as unknown as PrismaFoodSource);

    await prisma.foodDataSource.upsert({
      where: { source: prismaSource },
      create: {
        source: prismaSource,
        name: ds.name,
        license: ds.license,
        licenseUrl: ds.licenseUrl,
        attribution: ds.attribution,
        description: ds.description,
      },
      update: {
        name: ds.name,
        license: ds.license,
        licenseUrl: ds.licenseUrl,
        attribution: ds.attribution,
        description: ds.description,
      },
    });
  }

  // 3. Seed Reference Food Records through FoodImportService
  const importService = new FoodImportService(prisma);
  const indianAdapter = new ReferenceIndianFoodAdapter();

  const summary = await importService.importRecords(indianAdapter, SEED_FOODS, {
    dryRun: false,
    allowOverwriteVerified: true,
    batchNumber: 'SEED-INITIAL-CATALOG-V1',
  });

  return {
    categoriesCount: INITIAL_FOOD_CATEGORIES.length,
    dataSourcesCount: INITIAL_FOOD_DATA_SOURCES.length,
    foodsImported: summary.importedRecords,
  };
}
