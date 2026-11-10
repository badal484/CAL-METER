import { PrismaClient, FoodSource as PrismaFoodSource } from '@prisma/client';
import { validateBarcode, BarcodeFormat } from '@calmeter/shared';
import type { PackagedProductDto } from '@calmeter/contracts';
import { ValidationError, ProductNotFoundError } from '../../lib/errors.js';
import type { IBarcodeDataProvider } from './barcodeProvider.interface.js';
import { InternalDbBarcodeProvider } from './internalDbBarcode.provider.js';
import { OpenFoodFactsBarcodeProvider } from './openFoodFactsBarcode.provider.js';

export interface BarcodeLookupServiceOptions {
  prisma: PrismaClient;
  internalProvider?: IBarcodeDataProvider;
  externalProvider?: IBarcodeDataProvider;
}

export class BarcodeLookupService {
  private prisma: PrismaClient;
  private internalProvider: IBarcodeDataProvider;
  private externalProvider: IBarcodeDataProvider;

  constructor(options: BarcodeLookupServiceOptions) {
    this.prisma = options.prisma;
    this.internalProvider = options.internalProvider || new InternalDbBarcodeProvider(this.prisma);
    this.externalProvider = options.externalProvider || new OpenFoodFactsBarcodeProvider();
  }

  async lookup(rawBarcode: string, currentUserId?: string): Promise<PackagedProductDto> {
    // 1. Strict GS1 / Format validation
    const validation = validateBarcode(rawBarcode);
    if (!validation.isValid) {
      throw new ValidationError(
        validation.error || 'The scanned barcode is invalid or has an incorrect check digit.',
      );
    }

    const { normalizedBarcode, expandedBarcode } = validation;

    // 2. Query Internal Food Database
    let product = await this.internalProvider.lookupBarcode(normalizedBarcode, currentUserId);

    // If UPC-E, also attempt lookup of expanded UPC-A barcode in local database
    if (!product && expandedBarcode) {
      product = await this.internalProvider.lookupBarcode(expandedBarcode, currentUserId);
    }

    if (product) {
      return product;
    }

    // 3. Query External Food Provider (e.g. Open Food Facts)
    product = await this.externalProvider.lookupBarcode(normalizedBarcode);

    if (!product && expandedBarcode) {
      product = await this.externalProvider.lookupBarcode(expandedBarcode);
    }

    if (!product) {
      throw new ProductNotFoundError(
        `No packaged product found matching barcode ${normalizedBarcode}.`,
      );
    }

    // 4. Persist newly discovered external product to PostgreSQL database for O(1) future lookups
    try {
      const persistedId = await this.persistExternalProduct(product, validation.format);
      product.id = persistedId;
    } catch {
      // Non-fatal: if persistence encounters duplicate or constraint conflict, return transient result
    }

    return product;
  }

  private async persistExternalProduct(
    product: PackagedProductDto,
    format: BarcodeFormat,
  ): Promise<string> {
    return await this.prisma.$transaction(async tx => {
      // Check if food item already exists with this barcode
      const existing = await tx.foodItem.findFirst({
        where: {
          OR: [{ barcode: product.barcode }, { barcodes: { some: { barcode: product.barcode } } }],
        },
      });

      if (existing) {
        return existing.id;
      }

      // Create FoodItem
      const foodItem = await tx.foodItem.create({
        data: {
          name: product.name,
          brand: product.brand,
          manufacturer: product.manufacturer,
          barcode: product.barcode,
          source: PrismaFoodSource.OPEN_FOOD_FACTS,
          cuisine: 'GLOBAL',
          servingSize: product.servingSize,
          servingUnit: product.servingUnit,
          standardWeightGrams: product.standardWeightGrams,
          calories: product.nutrientsPer100g.calories,
          protein: product.nutrientsPer100g.protein,
          carbs: product.nutrientsPer100g.carbs,
          fat: product.nutrientsPer100g.fat,
          fiber: product.nutrientsPer100g.fiber ?? 0,
          imageUrl: product.imageUrl,
          ingredientsText: product.ingredientsText,
          allergens: product.allergens,
          countries: product.countries,
          netWeightGrams: product.netWeightGrams,
          isVerified: false,
          isCustom: false,
          nutrientProfile: {
            create: {
              calories: product.nutrientsPer100g.calories,
              protein: product.nutrientsPer100g.protein,
              carbs: product.nutrientsPer100g.carbs,
              fat: product.nutrientsPer100g.fat,
              saturatedFat: product.nutrientsPer100g.saturatedFat,
              transFat: product.nutrientsPer100g.transFat,
              fiber: product.nutrientsPer100g.fiber,
              sugar: product.nutrientsPer100g.sugar,
              addedSugar: product.nutrientsPer100g.addedSugar,
              sodium: product.nutrientsPer100g.sodium,
              cholesterol: product.nutrientsPer100g.cholesterol,
              potassium: product.nutrientsPer100g.potassium,
              calcium: product.nutrientsPer100g.calcium,
              iron: product.nutrientsPer100g.iron,
              vitaminD: product.nutrientsPer100g.vitaminD,
              vitaminB12: product.nutrientsPer100g.vitaminB12,
              micronutrients: product.nutrientsPer100g.micronutrients || {},
            },
          },
          barcodes: {
            create: {
              barcode: product.barcode,
              format: format.toString(),
            },
          },
        },
      });

      // Add serving conversion if present
      if (product.servingConversions && product.servingConversions.length > 0) {
        for (const sc of product.servingConversions) {
          await tx.servingUnitConversion.create({
            data: {
              foodItemId: foodItem.id,
              unitName: sc.unit,
              servingDescription: sc.notes || `1 ${sc.unit}`,
              gramWeight: sc.gramWeight,
              isDefault: sc.isDefault ?? true,
              provenance: (sc.provenance as any) || 'MANUFACTURER',
            },
          });
        }
      }

      return foodItem.id;
    });
  }
}
