import { PrismaClient, type Prisma } from '@prisma/client';
import type {
  CreateCustomFoodDto,
  UpdateCustomFoodDto,
  FoodItemDetailDto,
} from '@calmeter/contracts';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';

export class FoodManagementService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Fetches full food details with complete nutrient profile, serving conversions,
   * aliases, and categories. Enforces multi-tenant ownership on custom foods.
   */
  async getFoodById(id: string, currentUserId?: string): Promise<FoodItemDetailDto> {
    const food = await this.prisma.foodItem.findUnique({
      where: { id },
      include: {
        nutrientProfile: true,
        servingConversions: true,
        aliases: true,
        category: true,
        dataSource: true,
        recipeIngredients: true,
      },
    });

    if (!food || food.isArchived) {
      throw new NotFoundError('Food item not found.');
    }

    // Authorization safeguard: Private custom foods are only visible to their creator
    if (food.isCustom && food.createdByUserId !== currentUserId) {
      throw new NotFoundError('Food item not found.');
    }

    return this.mapToDetailDto(food);
  }

  /**
   * Creates a private custom food item for an authenticated user.
   */
  async createCustomFood(userId: string, data: CreateCustomFoodDto): Promise<FoodItemDetailDto> {
    const created = await this.prisma.$transaction(async tx => {
      const food = await tx.foodItem.create({
        data: {
          name: data.name,
          localNames: data.localNames || [],
          brand: data.brand,
          barcode: data.barcode,
          source: 'CUSTOM_USER',
          cuisine: data.cuisine,
          state: data.state,
          prepMethod: data.prepMethod,
          isCustom: true,
          isVerified: false,
          servingSize: data.servingSize,
          servingUnit: data.servingUnit,
          standardWeightGrams: data.standardWeightGrams,
          calories: data.calories,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
          fiber: data.fiber ?? 0,
          createdByUserId: userId,
        },
      });

      // Create nutrient profile
      await tx.foodNutrientProfile.create({
        data: {
          foodItemId: food.id,
          calories: data.calories,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
          saturatedFat: data.saturatedFat,
          transFat: data.transFat,
          fiber: data.fiber,
          sugar: data.sugar,
          addedSugar: data.addedSugar,
          sodium: data.sodium,
          cholesterol: data.cholesterol,
          potassium: data.potassium,
          calcium: data.calcium,
          iron: data.iron,
          vitaminD: data.vitaminD,
          vitaminB12: data.vitaminB12,
          micronutrients: (data.micronutrients || {}) as Prisma.InputJsonValue,
        },
      });

      // Serving conversions
      if (data.servingConversions && data.servingConversions.length > 0) {
        for (const conv of data.servingConversions) {
          await tx.servingUnitConversion.create({
            data: {
              foodItemId: food.id,
              unitName: conv.unit,
              servingDescription: conv.notes,
              gramWeight: conv.gramWeight,
              mlVolume: conv.volumeMl,
              provenance: conv.provenance || 'USER_CONFIGURED',
              isDefault: conv.isDefault ?? false,
            },
          });
        }
      }

      // Aliases if provided
      if (data.aliases && data.aliases.length > 0) {
        for (const a of data.aliases) {
          await tx.foodAlias.create({
            data: {
              foodItemId: food.id,
              alias: a.alias,
              language: a.language,
            },
          });
        }
      }

      return tx.foodItem.findUniqueOrThrow({
        where: { id: food.id },
        include: {
          nutrientProfile: true,
          servingConversions: true,
          aliases: true,
          category: true,
          dataSource: true,
          recipeIngredients: true,
        },
      });
    });

    return this.mapToDetailDto(created);
  }

  /**
   * Updates an existing custom food item. Validates ownership.
   */
  async updateCustomFood(
    id: string,
    userId: string,
    data: UpdateCustomFoodDto,
  ): Promise<FoodItemDetailDto> {
    const existing = await this.prisma.foodItem.findUnique({
      where: { id },
    });

    if (!existing || existing.isArchived) {
      throw new NotFoundError('Food item not found.');
    }

    if (!existing.isCustom) {
      throw new ForbiddenError('System catalog food items cannot be modified.');
    }

    if (existing.createdByUserId !== userId) {
      throw new ForbiddenError('You do not have permission to modify this custom food.');
    }

    const updated = await this.prisma.$transaction(async tx => {
      await tx.foodItem.update({
        where: { id },
        data: {
          name: data.name,
          localNames: data.localNames,
          brand: data.brand,
          barcode: data.barcode,
          cuisine: data.cuisine,
          state: data.state,
          prepMethod: data.prepMethod,
          servingSize: data.servingSize,
          servingUnit: data.servingUnit,
          standardWeightGrams: data.standardWeightGrams,
          calories: data.calories,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
          fiber: data.fiber,
        },
      });

      // Update nutrient profile if relevant fields provided
      await tx.foodNutrientProfile.upsert({
        where: { foodItemId: id },
        create: {
          foodItemId: id,
          calories: data.calories ?? Number(existing.calories),
          protein: data.protein ?? Number(existing.protein),
          carbs: data.carbs ?? Number(existing.carbs),
          fat: data.fat ?? Number(existing.fat),
          saturatedFat: data.saturatedFat,
          transFat: data.transFat,
          fiber: data.fiber ?? Number(existing.fiber),
          sugar: data.sugar,
          addedSugar: data.addedSugar,
          sodium: data.sodium,
          cholesterol: data.cholesterol,
          potassium: data.potassium,
          calcium: data.calcium,
          iron: data.iron,
          vitaminD: data.vitaminD,
          vitaminB12: data.vitaminB12,
          micronutrients: (data.micronutrients || {}) as Prisma.InputJsonValue,
        },
        update: {
          calories: data.calories,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
          saturatedFat: data.saturatedFat,
          transFat: data.transFat,
          fiber: data.fiber,
          sugar: data.sugar,
          addedSugar: data.addedSugar,
          sodium: data.sodium,
          cholesterol: data.cholesterol,
          potassium: data.potassium,
          calcium: data.calcium,
          iron: data.iron,
          vitaminD: data.vitaminD,
          vitaminB12: data.vitaminB12,
          micronutrients: data.micronutrients
            ? (data.micronutrients as Prisma.InputJsonValue)
            : undefined,
        },
      });

      // If servings are updated
      if (data.servingConversions) {
        await tx.servingUnitConversion.deleteMany({
          where: { foodItemId: id },
        });

        for (const conv of data.servingConversions) {
          await tx.servingUnitConversion.create({
            data: {
              foodItemId: id,
              unitName: conv.unit,
              servingDescription: conv.notes,
              gramWeight: conv.gramWeight,
              mlVolume: conv.volumeMl,
              provenance: conv.provenance || 'USER_CONFIGURED',
              isDefault: conv.isDefault ?? false,
            },
          });
        }
      }

      return tx.foodItem.findUniqueOrThrow({
        where: { id },
        include: {
          nutrientProfile: true,
          servingConversions: true,
          aliases: true,
          category: true,
          dataSource: true,
          recipeIngredients: true,
        },
      });
    });

    return this.mapToDetailDto(updated);
  }

  /**
   * Soft deletes a custom food item.
   */
  async deleteCustomFood(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.foodItem.findUnique({
      where: { id },
    });

    if (!existing || existing.isArchived) {
      throw new NotFoundError('Food item not found.');
    }

    if (!existing.isCustom || existing.createdByUserId !== userId) {
      throw new ForbiddenError('You do not have permission to delete this custom food.');
    }

    await this.prisma.foodItem.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  /**
   * Formats a raw Prisma food item entity into the FoodItemDetailDto.
   */
  private mapToDetailDto(
    item: Prisma.FoodItemGetPayload<{
      include: {
        nutrientProfile: true;
        servingConversions: true;
        aliases: true;
        category: true;
        dataSource: true;
        recipeIngredients: true;
      };
    }>,
  ): FoodItemDetailDto {
    return {
      id: item.id,
      name: item.name,
      localNames: item.localNames,
      brand: item.brand,
      barcode: item.barcode,
      source: item.source as FoodItemDetailDto['source'],
      externalId: item.externalId,
      cuisine: item.cuisine,
      state: item.state,
      prepMethod: item.prepMethod,
      isCustom: item.isCustom,
      isVerified: item.isVerified,
      isArchived: item.isArchived,
      confidenceScore: item.confidenceScore ? Number(item.confidenceScore) : null,
      servingSize: Number(item.servingSize),
      servingUnit: item.servingUnit,
      standardWeightGrams: Number(item.standardWeightGrams),
      calories: Number(item.calories),
      protein: Number(item.protein),
      carbs: Number(item.carbs),
      fat: Number(item.fat),
      fiber: Number(item.fiber),
      micronutrients: (item.micronutrients as Record<string, number>) || {},
      categoryId: item.categoryId,
      createdByUserId: item.createdByUserId,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      category: item.category
        ? {
            id: item.category.id,
            name: item.category.name,
            slug: item.category.slug,
            description: item.category.description,
          }
        : undefined,
      nutrientProfile: item.nutrientProfile
        ? {
            id: item.nutrientProfile.id,
            foodItemId: item.nutrientProfile.foodItemId,
            calories: Number(item.nutrientProfile.calories),
            protein: Number(item.nutrientProfile.protein),
            carbs: Number(item.nutrientProfile.carbs),
            fat: Number(item.nutrientProfile.fat),
            saturatedFat: item.nutrientProfile.saturatedFat
              ? Number(item.nutrientProfile.saturatedFat)
              : null,
            transFat: item.nutrientProfile.transFat ? Number(item.nutrientProfile.transFat) : null,
            fiber: item.nutrientProfile.fiber ? Number(item.nutrientProfile.fiber) : null,
            sugar: item.nutrientProfile.sugar ? Number(item.nutrientProfile.sugar) : null,
            addedSugar: item.nutrientProfile.addedSugar
              ? Number(item.nutrientProfile.addedSugar)
              : null,
            sodium: item.nutrientProfile.sodium ? Number(item.nutrientProfile.sodium) : null,
            cholesterol: item.nutrientProfile.cholesterol
              ? Number(item.nutrientProfile.cholesterol)
              : null,
            potassium: item.nutrientProfile.potassium
              ? Number(item.nutrientProfile.potassium)
              : null,
            calcium: item.nutrientProfile.calcium ? Number(item.nutrientProfile.calcium) : null,
            iron: item.nutrientProfile.iron ? Number(item.nutrientProfile.iron) : null,
            vitaminD: item.nutrientProfile.vitaminD ? Number(item.nutrientProfile.vitaminD) : null,
            vitaminB12: item.nutrientProfile.vitaminB12
              ? Number(item.nutrientProfile.vitaminB12)
              : null,
            micronutrients: (item.nutrientProfile.micronutrients as Record<string, number>) || {},
          }
        : undefined,
      servingConversions: item.servingConversions.map(sc => ({
        id: sc.id,
        foodItemId: sc.foodItemId,
        unit: sc.unitName,
        gramWeight: Number(sc.gramWeight),
        volumeMl: sc.mlVolume ? Number(sc.mlVolume) : undefined,
        provenance: sc.provenance as FoodItemDetailDto['servingConversions'][number]['provenance'],
        notes: sc.servingDescription || undefined,
        isDefault: sc.isDefault,
      })),
      aliases: item.aliases.map(a => ({
        id: a.id,
        foodItemId: a.foodItemId,
        alias: a.alias,
        language: a.language || undefined,
        isPrimary: a.isPrimary,
      })),
      recipeIngredients: item.recipeIngredients.map(ing => ({
        id: ing.id,
        parentFoodItemId: ing.parentFoodItemId,
        ingredientFoodItemId: ing.ingredientFoodItemId || undefined,
        ingredientName: ing.ingredientName,
        gramWeight: ing.gramWeight ? Number(ing.gramWeight) : undefined,
        notes: ing.notes || undefined,
        orderIndex: ing.orderIndex,
      })),
      dataSource: item.dataSource
        ? {
            id: item.dataSource.id,
            source: item.dataSource.source as FoodItemDetailDto['source'],
            name: item.dataSource.name,
            license: item.dataSource.license,
            licenseUrl: item.dataSource.licenseUrl || undefined,
            attribution: item.dataSource.attribution || undefined,
            description: item.dataSource.description || undefined,
          }
        : undefined,
    };
  }
}
