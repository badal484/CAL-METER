import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import type { RecognizedFoodItem } from '../ai/types.js';

export interface FoodMatchOption {
  foodItemId: string;
  name: string;
  localNames: string[];
  brand: string | null;
  cuisine: string | null;
  isVerified: boolean;
  isCustom: boolean;
  score: number;
  source: string;
  servingConversions: Array<{
    id: string;
    unitName: string;
    servingDescription?: string | null;
    gramWeight: number;
    isDefault: boolean;
  }>;
}

export type FoodMatchStatus =
  'EXACT_MATCH' | 'HIGH_CONFIDENCE' | 'AMBIGUOUS' | 'LOW_CONFIDENCE' | 'NO_MATCH';

export interface FoodMatchResult {
  candidateId: string;
  recognizedName: string;
  matchStatus: FoodMatchStatus;
  primaryMatch: FoodMatchOption | null;
  alternativeMatches: FoodMatchOption[];
}

export class FoodMatchingService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  /**
   * Matches an array of recognized food items against the database catalog.
   */
  async matchRecognizedItems(
    items: RecognizedFoodItem[],
    userId?: string,
  ): Promise<FoodMatchResult[]> {
    const results: FoodMatchResult[] = [];
    for (const item of items) {
      const matchResult = await this.matchSingleItem(item, userId);
      results.push(matchResult);
    }
    return results;
  }

  /**
   * Matches a single recognized food item against canonical names, aliases, and regional metadata.
   */
  async matchSingleItem(item: RecognizedFoodItem, userId?: string): Promise<FoodMatchResult> {
    const queryTerm = item.name.trim().toLowerCase();
    const alternateTerms = item.alternateNames.map(a => a.trim().toLowerCase());
    const searchTerms = [queryTerm, ...alternateTerms].filter(t => t.length > 1);

    // Multi-tenant filter: global unarchived foods OR user's own custom foods
    const tenantFilter: any = {
      isArchived: false,
      OR: [{ isCustom: false }, ...(userId ? [{ isCustom: true, createdByUserId: userId }] : [])],
    };

    // Query candidates matching name, brand, or aliases
    const searchFilter: any = {
      OR: [
        { name: { contains: queryTerm, mode: 'insensitive' } },
        ...alternateTerms.map(term => ({ name: { contains: term, mode: 'insensitive' } })),
        {
          aliases: {
            some: {
              alias: {
                in: searchTerms,
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    };

    const candidates = await this.prisma.foodItem.findMany({
      where: {
        AND: [tenantFilter, searchFilter],
      },
      include: {
        aliases: true,
        servingConversions: true,
      },
      take: 20,
    });

    if (candidates.length === 0) {
      return {
        candidateId: item.id,
        recognizedName: item.name,
        matchStatus: 'NO_MATCH',
        primaryMatch: null,
        alternativeMatches: [],
      };
    }

    // Score and rank candidates
    const scoredOptions: FoodMatchOption[] = candidates
      .map(cand => {
        const score = this.calculateMatchScore(item, cand);
        return {
          foodItemId: cand.id,
          name: cand.name,
          localNames: cand.localNames,
          brand: cand.brand,
          cuisine: cand.cuisine,
          isVerified: cand.isVerified,
          isCustom: cand.isCustom,
          score,
          source: cand.source,
          servingConversions: cand.servingConversions.map(conv => ({
            id: conv.id,
            unitName: conv.unitName,
            servingDescription: conv.servingDescription,
            gramWeight: Number(conv.gramWeight),
            isDefault: conv.isDefault,
          })),
        };
      })
      .sort((a, b) => b.score - a.score);

    const topCandidate = scoredOptions[0];
    const secondCandidate = scoredOptions[1];

    let matchStatus: FoodMatchStatus = 'NO_MATCH';

    if (!topCandidate || topCandidate.score < 0.5) {
      matchStatus = 'NO_MATCH';
    } else if (
      topCandidate.score >= 0.95 &&
      (!secondCandidate || topCandidate.score - secondCandidate.score > 0.08)
    ) {
      matchStatus = 'EXACT_MATCH';
    } else if (
      topCandidate.score >= 0.85 &&
      (!secondCandidate || topCandidate.score - secondCandidate.score >= 0.1)
    ) {
      matchStatus = 'HIGH_CONFIDENCE';
    } else if (
      secondCandidate &&
      topCandidate.score >= 0.78 &&
      Math.abs(topCandidate.score - secondCandidate.score) <= 0.08
    ) {
      matchStatus = 'AMBIGUOUS';
    } else {
      matchStatus = 'LOW_CONFIDENCE';
    }

    return {
      candidateId: item.id,
      recognizedName: item.name,
      matchStatus,
      primaryMatch: topCandidate && topCandidate.score >= 0.5 ? topCandidate : null,
      alternativeMatches: scoredOptions.slice(1, 5).filter(opt => opt.score >= 0.4),
    };
  }

  /**
   * Computes a relevance similarity score between 0.00 and 1.00.
   */
  private calculateMatchScore(item: RecognizedFoodItem, candidate: any): number {
    const recognizedName = item.name.trim().toLowerCase();
    const candidateName = candidate.name.trim().toLowerCase();

    // 1. Exact canonical name match
    if (recognizedName === candidateName) {
      return 1.0;
    }

    // 2. Exact match in localNames array
    const lowerLocalNames = (candidate.localNames || []).map((l: string) => l.trim().toLowerCase());
    if (lowerLocalNames.includes(recognizedName)) {
      return 0.97;
    }

    // 3. Exact match against candidate's aliases
    const aliasMatches = (candidate.aliases || []).some(
      (a: any) =>
        a.alias.trim().toLowerCase() === recognizedName ||
        item.alternateNames.some(alt => alt.trim().toLowerCase() === a.alias.trim().toLowerCase()),
    );
    if (aliasMatches) {
      return 0.96;
    }

    // 4. Prefix match
    if (candidateName.startsWith(recognizedName) || recognizedName.startsWith(candidateName)) {
      return 0.9;
    }

    // 5. Substring / Token Jaccard overlap
    const recognizedTokens = new Set(
      recognizedName
        .split(/[\s/,-]+/)
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 2),
    );
    const candidateTokens = new Set(
      candidateName
        .split(/[\s/,-]+/)
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 2),
    );

    let intersectionCount = 0;
    for (const token of recognizedTokens) {
      if (candidateTokens.has(token)) {
        intersectionCount++;
      }
    }

    const unionCount = new Set([...recognizedTokens, ...candidateTokens]).size;
    const jaccard = unionCount > 0 ? intersectionCount / unionCount : 0;

    let baseScore = Math.min(0.85, 0.4 + jaccard * 0.45);

    // Boost score if cuisine matches
    if (
      item.cuisine &&
      candidate.cuisine &&
      item.cuisine.toLowerCase() === candidate.cuisine.toLowerCase()
    ) {
      baseScore = Math.min(0.98, baseScore + 0.04);
    }

    // Verified foods get slight tie-breaker preference over unverified items
    if (candidate.isVerified) {
      baseScore = Math.min(0.99, baseScore + 0.02);
    }

    return Number(baseScore.toFixed(2));
  }
}

export const defaultFoodMatchingService = new FoodMatchingService();
