import { PrismaClient } from '@prisma/client';
import { DataQuality, FoodSource, roundTo } from '@calmeter/shared';
import type { PackagedProductDto, PackagedProductNutrients } from '@calmeter/contracts';
import type { IBarcodeDataProvider } from './barcodeProvider.interface.js';

export class InternalDbBarcodeProvider implements IBarcodeDataProvider {
  readonly providerName = 'Internal Database';

  constructor(private prisma: PrismaClient) {}

  async lookupBarcode(barcode: string, currentUserId?: string): Promise<PackagedProductDto | null> {
    const cleanBarcode = barcode.replace(/[\s\-_]/g, '').trim();

    // 1. Check food_barcodes table first (handles secondary / multi-barcode mapping)
    const barcodeRecord = await this.prisma.foodBarcode.findUnique({
      where: { barcode: cleanBarcode },
      include: {
        foodItem: {
          include: {
            nutrientProfile: true,
            servingConversions: true,
            barcodes: true,
            category: true,
          },
        },
      },
    });

    let foodItem = barcodeRecord?.foodItem;

    // 2. If not found in food_barcodes, check food_items directly
    if (!foodItem) {
      const directItem = await this.prisma.foodItem.findUnique({
        where: { barcode: cleanBarcode },
        include: {
          nutrientProfile: true,
          servingConversions: true,
          barcodes: true,
          category: true,
        },
      });
      if (directItem) {
        foodItem = directItem;
      }
    }

    if (!foodItem) {
      return null;
    }

    // 3. Visibility & Soft Deletion Guard
    if (foodItem.isArchived) {
      return null;
    }

    // Tenant Isolation Guard: custom foods belonging to other users must not be exposed
    if (foodItem.isCustom && foodItem.createdByUserId !== currentUserId) {
      return null;
    }

    return this.mapToPackagedProductDto(foodItem, cleanBarcode);
  }

  private mapToPackagedProductDto(item: any, searchedBarcode: string): PackagedProductDto {
    const allBarcodes = new Set<string>();
    if (item.barcode) allBarcodes.add(item.barcode);
    if (Array.isArray(item.barcodes)) {
      item.barcodes.forEach((b: { barcode: string }) => allBarcodes.add(b.barcode));
    }
    allBarcodes.delete(searchedBarcode);

    const servingSize = Number(item.servingSize || 100);
    const standardWeightGrams = Number(item.standardWeightGrams || 100);
    const np = item.nutrientProfile;

    const calories = Number(np?.calories ?? item.calories);
    const protein = Number(np?.protein ?? item.protein);
    const carbs = Number(np?.carbs ?? item.carbs);
    const fat = Number(np?.fat ?? item.fat);

    const saturatedFat =
      np?.saturatedFat !== null && np?.saturatedFat !== undefined ? Number(np.saturatedFat) : null;
    const transFat =
      np?.transFat !== null && np?.transFat !== undefined ? Number(np.transFat) : null;
    const fiber =
      np?.fiber !== null && np?.fiber !== undefined
        ? Number(np.fiber)
        : item.fiber !== null && item.fiber !== undefined
          ? Number(item.fiber)
          : null;
    const sugar = np?.sugar !== null && np?.sugar !== undefined ? Number(np.sugar) : null;
    const addedSugar =
      np?.addedSugar !== null && np?.addedSugar !== undefined ? Number(np.addedSugar) : null;
    const sodium = np?.sodium !== null && np?.sodium !== undefined ? Number(np.sodium) : null;
    const cholesterol =
      np?.cholesterol !== null && np?.cholesterol !== undefined ? Number(np.cholesterol) : null;
    const potassium =
      np?.potassium !== null && np?.potassium !== undefined ? Number(np.potassium) : null;
    const calcium = np?.calcium !== null && np?.calcium !== undefined ? Number(np.calcium) : null;
    const iron = np?.iron !== null && np?.iron !== undefined ? Number(np.iron) : null;
    const vitaminD =
      np?.vitaminD !== null && np?.vitaminD !== undefined ? Number(np.vitaminD) : null;
    const vitaminB12 =
      np?.vitaminB12 !== null && np?.vitaminB12 !== undefined ? Number(np.vitaminB12) : null;
    const micronutrients =
      (np?.micronutrients as Record<string, number>) ||
      (item.micronutrients as Record<string, number>) ||
      {};

    const missingNutrients: string[] = [];
    if (saturatedFat === null) missingNutrients.push('saturatedFat');
    if (transFat === null) missingNutrients.push('transFat');
    if (fiber === null) missingNutrients.push('fiber');
    if (sugar === null) missingNutrients.push('sugar');
    if (addedSugar === null) missingNutrients.push('addedSugar');
    if (sodium === null) missingNutrients.push('sodium');
    if (cholesterol === null) missingNutrients.push('cholesterol');
    if (potassium === null) missingNutrients.push('potassium');
    if (calcium === null) missingNutrients.push('calcium');
    if (iron === null) missingNutrients.push('iron');
    if (vitaminD === null) missingNutrients.push('vitaminD');
    if (vitaminB12 === null) missingNutrients.push('vitaminB12');

    const nutrientsPer100g: PackagedProductNutrients = {
      calories,
      protein,
      carbs,
      fat,
      saturatedFat,
      transFat,
      fiber,
      sugar,
      addedSugar,
      sodium,
      cholesterol,
      potassium,
      calcium,
      iron,
      vitaminD,
      vitaminB12,
      micronutrients,
    };

    // Calculate nutrients per serving if serving size differs from 100g
    let nutrientsPerServing: PackagedProductNutrients | null = null;
    if (servingSize > 0 && Math.abs(servingSize - standardWeightGrams) > 0.01) {
      const factor = servingSize / standardWeightGrams;
      nutrientsPerServing = {
        calories: roundTo(calories * factor, 1),
        protein: roundTo(protein * factor, 1),
        carbs: roundTo(carbs * factor, 1),
        fat: roundTo(fat * factor, 1),
        saturatedFat: saturatedFat !== null ? roundTo(saturatedFat * factor, 2) : null,
        transFat: transFat !== null ? roundTo(transFat * factor, 2) : null,
        fiber: fiber !== null ? roundTo(fiber * factor, 2) : null,
        sugar: sugar !== null ? roundTo(sugar * factor, 2) : null,
        addedSugar: addedSugar !== null ? roundTo(addedSugar * factor, 2) : null,
        sodium: sodium !== null ? roundTo(sodium * factor, 1) : null,
        cholesterol: cholesterol !== null ? roundTo(cholesterol * factor, 1) : null,
        potassium: potassium !== null ? roundTo(potassium * factor, 1) : null,
        calcium: calcium !== null ? roundTo(calcium * factor, 1) : null,
        iron: iron !== null ? roundTo(iron * factor, 2) : null,
        vitaminD: vitaminD !== null ? roundTo(vitaminD * factor, 2) : null,
        vitaminB12: vitaminB12 !== null ? roundTo(vitaminB12 * factor, 2) : null,
        micronutrients: {},
      };
    } else if (servingSize > 0) {
      nutrientsPerServing = { ...nutrientsPer100g };
    }

    const isLiquid =
      item.servingUnit?.toLowerCase() === 'ml' || item.servingUnit?.toLowerCase() === 'l';

    let dataQuality = DataQuality.EXTERNAL_SOURCE;
    if (item.isVerified) {
      dataQuality = DataQuality.VERIFIED;
    } else if (item.isCustom) {
      dataQuality = DataQuality.USER_ENTERED;
    } else if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) {
      dataQuality = DataQuality.INCOMPLETE;
    }

    let attribution = 'CAL METER Verified Food Database';
    let license = 'Proprietary / Verified Community';
    if (item.source === 'OPEN_FOOD_FACTS') {
      attribution = 'Data sourced from Open Food Facts under ODbL 1.0';
      license = 'Open Database License (ODbL) v1.0';
    } else if (item.source === 'USDA_FOOD_DATA_CENTRAL') {
      attribution = 'USDA FoodData Central (Public Domain)';
      license = 'U.S. Public Domain / CC0';
    } else if (item.source === 'ICMR_NIN_IFCT' || item.source === 'INDIAN_FCT_NIN') {
      attribution = 'Indian Food Composition Tables (ICMR-NIN)';
      license = 'Government of India Open Data / Academic Fair Use';
    } else if (item.isCustom) {
      attribution = 'Custom food record created by user';
      license = 'Private User Data';
    }

    const servingConversions = (item.servingConversions || []).map((c: any) => ({
      id: c.id,
      foodItemId: c.foodItemId,
      unit: c.unitName,
      gramWeight: Number(c.gramWeight),
      provenance: c.provenance,
      isDefault: c.isDefault ?? false,
      notes: c.servingDescription || undefined,
    }));

    return {
      id: item.id,
      barcode: searchedBarcode,
      additionalBarcodes: Array.from(allBarcodes),
      name: item.name,
      brand: item.brand || null,
      manufacturer: item.manufacturer || null,
      imageUrl: item.imageUrl || null,
      categories: item.category ? [item.category.name] : [],
      countries: item.countries || [],
      ingredientsText: item.ingredientsText || null,
      allergens: item.allergens || [],
      servingSize,
      servingUnit: item.servingUnit || 'g',
      standardWeightGrams,
      netWeightGrams: item.netWeightGrams ? Number(item.netWeightGrams) : null,
      isLiquid,
      nutrientsPer100g,
      nutrientsPerServing,
      servingConversions,
      source: item.source as FoodSource,
      attribution,
      license,
      isVerified: item.isVerified,
      dataQuality,
      missingNutrients,
    };
  }
}
