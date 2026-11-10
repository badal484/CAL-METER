import { PrismaClient, type Prisma, type FoodSource } from '@prisma/client';
import type {
  FoodSearchQuery,
  FoodSearchResponse,
  FoodSearchResultItem,
} from '@calmeter/contracts';

export class FoodSearchService {
  constructor(private prisma: PrismaClient) {}

  async searchFoods(query: FoodSearchQuery, currentUserId?: string): Promise<FoodSearchResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const trimmedQ = query.q ? query.q.trim() : undefined;
    const barcode = query.barcode ? query.barcode.trim() : undefined;

    // Base visibility filter:
    // Only non-archived foods.
    // Public foods (isCustom = false) OR user's own custom foods (isCustom = true AND createdByUserId = currentUserId)
    const visibilityConditions: Prisma.FoodItemWhereInput[] = [{ isCustom: false }];
    if (currentUserId) {
      visibilityConditions.push({
        isCustom: true,
        createdByUserId: currentUserId,
      });
    }

    const where: Prisma.FoodItemWhereInput = {
      isArchived: false,
      OR: visibilityConditions,
    };

    // Filter by barcode if provided
    if (barcode) {
      where.barcode = barcode;
    }

    // Filter by category if provided
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    // Filter by cuisine if provided
    if (query.cuisine) {
      where.cuisine = { equals: query.cuisine, mode: 'insensitive' };
    }

    // Filter by source if provided
    if (query.source) {
      where.source = query.source as FoodSource;
    }

    // Text search on name, brand, localNames, or aliases
    if (trimmedQ) {
      where.AND = [
        {
          OR: [
            { name: { contains: trimmedQ, mode: 'insensitive' } },
            { brand: { contains: trimmedQ, mode: 'insensitive' } },
            { localNames: { hasSome: [trimmedQ] } },
            { aliases: { some: { alias: { contains: trimmedQ, mode: 'insensitive' } } } },
          ],
        },
      ];
    }

    // Build sorting
    let orderBy: Prisma.FoodItemOrderByWithRelationInput = { name: 'asc' };
    if (query.sortBy === 'calories') {
      orderBy = { calories: query.sortOrder || 'asc' };
    } else if (query.sortBy === 'protein') {
      orderBy = { protein: query.sortOrder || 'desc' };
    } else if (query.sortBy === 'createdAt') {
      orderBy = { createdAt: query.sortOrder || 'desc' };
    } else if (query.sortBy === 'name') {
      orderBy = { name: query.sortOrder || 'asc' };
    }

    const [total, items] = await Promise.all([
      this.prisma.foodItem.count({ where }),
      this.prisma.foodItem.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          servingConversions: true,
          aliases: { select: { alias: true, language: true, isPrimary: true } },
        },
      }),
    ]);

    // Format results to DTO
    let mappedItems: FoodSearchResultItem[] = items.map(item => ({
      id: item.id,
      name: item.name,
      localNames: item.localNames,
      brand: item.brand,
      barcode: item.barcode,
      source: item.source as FoodSearchResponse['items'][number]['source'],
      cuisine: item.cuisine,
      servingSize: Number(item.servingSize),
      servingUnit: item.servingUnit,
      standardWeightGrams: Number(item.standardWeightGrams),
      calories: Number(item.calories),
      protein: Number(item.protein),
      carbs: Number(item.carbs),
      fat: Number(item.fat),
      fiber: Number(item.fiber),
      isVerified: item.isVerified,
      isCustom: item.isCustom,
      category: item.category
        ? {
            id: item.category.id,
            name: item.category.name,
            slug: item.category.slug,
          }
        : undefined,
      servingConversions: item.servingConversions.map(sc => ({
        id: sc.id,
        foodItemId: sc.foodItemId,
        unit: sc.unitName,
        gramWeight: Number(sc.gramWeight),
        volumeMl: sc.mlVolume ? Number(sc.mlVolume) : undefined,
        provenance:
          sc.provenance as FoodSearchResultItem['servingConversions'][number]['provenance'],
        notes: sc.servingDescription || undefined,
        isDefault: sc.isDefault,
      })),
    }));

    // If relevance sorting and text query is present, rank exact/prefix matches first
    if ((query.sortBy === 'relevance' || !query.sortBy) && trimmedQ) {
      const qLower = trimmedQ.toLowerCase();
      mappedItems = mappedItems.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        // Exact name match
        if (aName === qLower && bName !== qLower) return -1;
        if (bName === qLower && aName !== qLower) return 1;

        // Exact local name or alias match
        const aExactAlias = a.localNames.some(l => l.toLowerCase() === qLower);
        const bExactAlias = b.localNames.some(l => l.toLowerCase() === qLower);
        if (aExactAlias && !bExactAlias) return -1;
        if (bExactAlias && !aExactAlias) return 1;

        // Starts with query in name
        const aStarts = aName.startsWith(qLower);
        const bStarts = bName.startsWith(qLower);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;

        return aName.localeCompare(bName);
      });
    }

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: mappedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
