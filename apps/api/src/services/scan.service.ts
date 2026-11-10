import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { DomainValidationError } from '@calmeter/shared';
import { DailyScanLimitReachedError } from '../lib/errors.js';
import { getVisionProvider } from '../ai/factory.js';
import { IFoodVisionProvider } from '../ai/types.js';
import { defaultStorageService, IObjectStorageService } from '../storage/storage.service.js';
import { validateAndSanitizeImage } from '../storage/imageValidator.js';
import { FoodMatchingService } from './foodMatching.service.js';
import {
  NutritionCalculationService,
  defaultNutritionCalculationService,
  CalculatedItemResult,
} from './nutritionCalculation.service.js';
import type {
  CreateScanRequest,
  CreateScanResponse,
  ScanDetailResponse,
  SubmitScanCorrection,
  ConfirmScanRequest,
  ConfirmScanResponse,
  CancelScanResponse,
  FoodCandidate,
} from '@calmeter/contracts';

export interface ScanServiceOptions {
  prisma?: PrismaClient;
  visionProvider?: IFoodVisionProvider;
  storageService?: IObjectStorageService;
  matchingService?: FoodMatchingService;
  nutritionService?: NutritionCalculationService;
  dailyScanLimit?: number;
}

export class ScanService {
  private prisma: PrismaClient;
  private visionProvider: IFoodVisionProvider;
  private storageService: IObjectStorageService;
  private matchingService: FoodMatchingService;
  private nutritionService: NutritionCalculationService;
  private dailyScanLimit: number;

  constructor(options?: ScanServiceOptions) {
    this.prisma = options?.prisma || getPrismaClient();
    this.visionProvider = options?.visionProvider || getVisionProvider();
    this.storageService = options?.storageService || defaultStorageService;
    this.matchingService = options?.matchingService || new FoodMatchingService(this.prisma);
    this.nutritionService = options?.nutritionService || defaultNutritionCalculationService;
    this.dailyScanLimit = options?.dailyScanLimit || Number(process.env.DAILY_FREE_SCAN_LIMIT) || 3;
  }

  /**
   * Creates a new scan session, enforces daily scan quota, and generates upload credentials.
   */
  async createScan(userId: string, input: CreateScanRequest): Promise<CreateScanResponse> {
    // 1. Enforce Daily Free Scan Quota
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const todayScanCount = await this.prisma.foodScanLog.count({
      where: {
        userId,
        createdAt: { gte: todayStart },
        status: { notIn: ['CANCELLED', 'FAILED'] },
      },
    });

    if (todayScanCount >= this.dailyScanLimit) {
      throw new DailyScanLimitReachedError(
        `Daily scan quota reached (${todayScanCount}/${this.dailyScanLimit} scans used today). Upgrade to CAL METER Pro for unlimited food scanning.`,
      );
    }

    // 2. Generate Scan Record
    const scanId = randomUUID();
    const ext =
      input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const storageKey = this.storageService.generateStorageKey(userId, scanId, ext);

    await this.prisma.foodScanLog.create({
      data: {
        id: scanId,
        userId,
        storageKey,
        status: 'CREATED',
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes || null,
        mealType: input.mealType || null,
        rawAiResponse: {},
        detectedItems: [],
        userCorrections: [],
        nutritionResult: {},
        matchedFoodIds: [],
        latencyMs: 0,
      },
    });

    // 3. Generate Secure Upload URL
    const uploadDetails = await this.storageService.generatePresignedUploadUrl(
      storageKey,
      input.mimeType,
      300,
    );

    return {
      scanId,
      status: 'CREATED' as any,
      storageKey,
      uploadUrl: uploadDetails.uploadUrl,
      expiresInSeconds: uploadDetails.expiresInSeconds,
    };
  }

  /**
   * Accepts and validates image binary, strips EXIF metadata, and marks scan as UPLOADED.
   */
  async uploadScanImage(
    scanId: string,
    userId: string,
    buffer: Buffer,
    declaredMimeType?: string,
  ): Promise<ScanDetailResponse> {
    const scan = await this.prisma.foodScanLog.findUnique({
      where: { id: scanId },
    });

    if (!scan) {
      throw new DomainValidationError(`Scan session not found: ${scanId}`);
    }

    if (scan.userId !== userId) {
      throw new DomainValidationError('Unauthorized: Scan session belongs to another user.');
    }

    if (scan.status !== 'CREATED' && scan.status !== 'UPLOADED') {
      throw new DomainValidationError(
        `Cannot upload image to scan in state '${scan.status}'. Only CREATED scans accept uploads.`,
      );
    }

    // Validate binary signature, dimensions, and strip EXIF metadata
    const validated = validateAndSanitizeImage(
      buffer,
      declaredMimeType || scan.mimeType || undefined,
    );

    // Save sanitized buffer to object storage
    await this.storageService.saveImage(
      scan.storageKey,
      validated.sanitizedBuffer,
      validated.mimeType,
    );

    const updated = await this.prisma.foodScanLog.update({
      where: { id: scanId },
      data: {
        status: 'UPLOADED',
        mimeType: validated.mimeType,
        fileSizeBytes: validated.fileSizeBytes,
        imageWidth: validated.width,
        imageHeight: validated.height,
        uploadedAt: new Date(),
      },
    });

    return this.mapToDetailResponse(updated);
  }

  /**
   * Submits the uploaded scan for asynchronous processing.
   */
  async enqueueScanProcessing(scanId: string, userId: string): Promise<ScanDetailResponse> {
    const scan = await this.prisma.foodScanLog.findUnique({
      where: { id: scanId },
    });

    if (!scan) {
      throw new DomainValidationError(`Scan not found: ${scanId}`);
    }

    if (scan.userId !== userId) {
      throw new DomainValidationError('Unauthorized: Scan belongs to another user.');
    }

    // Idempotency: If already queued or in progress, return without re-enqueuing
    if (['QUEUED', 'PROCESSING', 'NEEDS_REVIEW', 'COMPLETED'].includes(scan.status)) {
      return this.mapToDetailResponse(scan);
    }

    if (scan.status !== 'UPLOADED') {
      throw new DomainValidationError(
        `Cannot process scan in status '${scan.status}'. Scan must be UPLOADED before processing.`,
      );
    }

    // Verify storage has the image
    const hasImage = await this.storageService.hasImage(scan.storageKey);
    if (!hasImage) {
      throw new DomainValidationError('Scan image file not found in storage. Please re-upload.');
    }

    const updated = await this.prisma.foodScanLog.update({
      where: { id: scanId },
      data: { status: 'QUEUED' },
    });

    // In non-queue or test execution, execute pipeline directly
    return this.mapToDetailResponse(updated);
  }

  /**
   * Executes the full AI recognition, catalog matching, and deterministic nutrition pipeline.
   */
  async processScan(scanId: string): Promise<ScanDetailResponse> {
    const scan = await this.prisma.foodScanLog.findUnique({
      where: { id: scanId },
    });

    if (!scan) {
      throw new DomainValidationError(`Scan not found: ${scanId}`);
    }

    // If already reviewed or completed, return as-is
    if (['NEEDS_REVIEW', 'COMPLETED'].includes(scan.status)) {
      return this.mapToDetailResponse(scan);
    }

    await this.prisma.foodScanLog.update({
      where: { id: scanId },
      data: { status: 'PROCESSING' },
    });

    try {
      const imageBuffer = await this.storageService.getImage(scan.storageKey);
      const mimeType = (scan.mimeType as any) || 'image/jpeg';

      // 1. Multimodal AI Visual Identification Stage
      const visionResult = await this.visionProvider.recognizeFood({
        imageBuffer,
        mimeType,
        scanId,
        userId: scan.userId,
        hintMealType: scan.mealType || undefined,
      });

      // 2. Structured Catalog Matching Stage
      const matchResults = await this.matchingService.matchRecognizedItems(
        visionResult.items,
        scan.userId,
      );

      // 3. Deterministic Nutrition Calculation Stage
      const foodCandidates: FoodCandidate[] = [];
      const matchedFoodIds: string[] = [];
      const calculatedItems: CalculatedItemResult[] = [];

      for (let i = 0; i < visionResult.items.length; i++) {
        const item = visionResult.items[i]!;
        const match = matchResults[i];

        let primaryFoodRecord: any = null;
        let calculatedNutrients: any = undefined;

        if (match?.primaryMatch?.foodItemId) {
          matchedFoodIds.push(match.primaryMatch.foodItemId);
          primaryFoodRecord = await this.prisma.foodItem.findUnique({
            where: { id: match.primaryMatch.foodItemId },
            include: {
              nutrientProfile: true,
              servingConversions: true,
            },
          });

          if (primaryFoodRecord) {
            const calculated = this.nutritionService.calculateItemNutrition(
              item.id,
              primaryFoodRecord as any,
              item.portion.quantity,
              item.portion.unit,
              item.portion.estimatedGrams,
            );
            calculatedItems.push(calculated);

            calculatedNutrients = {
              calories: calculated.calories,
              protein: calculated.protein,
              carbs: calculated.carbs,
              fat: calculated.fat,
              fiber: calculated.fiber,
              sodium: calculated.sodium,
              sugar: calculated.sugar,
              micronutrients: calculated.micronutrients,
              provenance: calculated.provenance,
            };
          }
        }

        foodCandidates.push({
          id: item.id,
          name: item.name,
          alternateNames: item.alternateNames,
          category: item.category,
          cuisine: item.cuisine,
          preparationMethod: item.preparationMethod,
          rawCookedState: item.rawCookedState,
          components: item.components,
          portion: {
            quantity: item.portion.quantity,
            unit: item.portion.unit,
            estimatedGrams: item.portion.estimatedGrams,
            minGrams: item.portion.minGrams,
            maxGrams: item.portion.maxGrams,
            servingDescription: item.portion.servingDescription,
            confidence: item.portion.confidence,
          },
          confidence: item.confidenceScore,
          matchStatus: (match?.matchStatus as any) || 'NO_MATCH',
          primaryMatch: (match?.primaryMatch as any) || null,
          alternativeMatches: (match?.alternativeMatches as any) || [],
          calculatedNutrients,
          uncertaintyReason: item.uncertaintyReason,
          visualIndicators: item.visualIndicators,
        });
      }

      // 4. Aggregate Nutrition for Entire Plate/Meal
      const aggregateNutrition = this.nutritionService.aggregateMealNutrition(calculatedItems);

      const updatedScan = await this.prisma.foodScanLog.update({
        where: { id: scanId },
        data: {
          status: 'NEEDS_REVIEW',
          provider: visionResult.provider,
          model: visionResult.model,
          latencyMs: visionResult.latencyMs,
          promptTokens: visionResult.usage?.promptTokens || null,
          completionTokens: visionResult.usage?.completionTokens || null,
          rawAiResponse: (visionResult.rawOutput as any) || {
            sceneContext: visionResult.sceneContext,
          },
          detectedItems: foodCandidates as any,
          matchedFoodIds,
          nutritionResult: aggregateNutrition as any,
          processedAt: new Date(),
          errorMessage: null,
          failureReason: null,
        },
      });

      return this.mapToDetailResponse(updatedScan, visionResult.uncertaintyNotes);
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || 'AI recognition pipeline failed';
      const failureReason = (err as any)?.code || (err as Error)?.name || 'PROCESSING_ERROR';

      await this.prisma.foodScanLog.update({
        where: { id: scanId },
        data: {
          status: 'FAILED',
          errorMessage: errorMsg,
          failureReason,
        },
      });

      throw err;
    }
  }

  /**
   * Retrieves current scan status, recognition candidates, and calculated nutrition.
   */
  async getScan(scanId: string, userId: string): Promise<ScanDetailResponse> {
    const scan = await this.prisma.foodScanLog.findUnique({
      where: { id: scanId },
    });

    if (!scan) {
      throw new DomainValidationError(`Scan not found: ${scanId}`);
    }

    if (scan.userId !== userId) {
      throw new DomainValidationError('Unauthorized: Scan belongs to another user.');
    }

    return this.mapToDetailResponse(scan);
  }

  /**
   * Submits user corrections without overwriting original AI estimates.
   * Recalculates backend nutrition deterministically.
   */
  async applyCorrections(
    scanId: string,
    userId: string,
    corrections: SubmitScanCorrection,
  ): Promise<ScanDetailResponse> {
    const scan = await this.prisma.foodScanLog.findUnique({
      where: { id: scanId },
    });

    if (!scan) {
      throw new DomainValidationError(`Scan not found: ${scanId}`);
    }

    if (scan.userId !== userId) {
      throw new DomainValidationError('Unauthorized: Scan belongs to another user.');
    }

    if (scan.status !== 'NEEDS_REVIEW') {
      throw new DomainValidationError(
        `Cannot apply corrections to scan in status '${scan.status}'. Only scans in NEEDS_REVIEW can be corrected.`,
      );
    }

    // Clone original detected items to protect pristine AI output
    const originalItems = (scan.detectedItems as any[]) || [];
    let currentCandidates: FoodCandidate[] = JSON.parse(JSON.stringify(originalItems));

    for (const correction of corrections.items) {
      if (correction.action === 'REMOVE') {
        currentCandidates = currentCandidates.filter(c => c.id !== correction.candidateId);
      } else if (correction.action === 'UPDATE') {
        const index = currentCandidates.findIndex(c => c.id === correction.candidateId);
        if (index >= 0) {
          const item = currentCandidates[index]!;
          if (correction.portion) {
            item.portion.quantity = correction.portion.quantity;
            item.portion.unit = correction.portion.unit;
            item.portion.estimatedGrams = correction.portion.gramWeight;
          }
          if (correction.matchedFoodId) {
            // User manually selected a different food from the database
            const newFood = await this.prisma.foodItem.findUnique({
              where: { id: correction.matchedFoodId },
              include: { servingConversions: true, nutrientProfile: true },
            });
            if (newFood) {
              item.primaryMatch = {
                foodItemId: newFood.id,
                name: newFood.name,
                localNames: newFood.localNames,
                brand: newFood.brand,
                cuisine: newFood.cuisine,
                isVerified: newFood.isVerified,
                isCustom: newFood.isCustom,
                score: 1.0,
                source: newFood.source,
                servingConversions: newFood.servingConversions.map(conv => ({
                  id: conv.id,
                  unitName: conv.unitName,
                  servingDescription: conv.servingDescription,
                  gramWeight: Number(conv.gramWeight),
                  isDefault: conv.isDefault,
                })),
              };
              item.matchStatus = 'EXACT_MATCH';
            }
          }
        }
      } else if (correction.action === 'ADD') {
        // User manually added a food item missed by the AI
        if (!correction.matchedFoodId) {
          throw new DomainValidationError("Adding a new food item requires a 'matchedFoodId'.");
        }
        const newFood = await this.prisma.foodItem.findUnique({
          where: { id: correction.matchedFoodId },
          include: { servingConversions: true, nutrientProfile: true },
        });
        if (newFood) {
          currentCandidates.push({
            id: correction.candidateId || `cand-added-${randomUUID().slice(0, 8)}`,
            name: correction.name || newFood.name,
            alternateNames: newFood.localNames,
            category: 'user-added',
            components: [],
            portion: {
              quantity: correction.portion?.quantity || 1,
              unit: correction.portion?.unit || newFood.servingUnit || 'serving',
              estimatedGrams:
                correction.portion?.gramWeight || Number(newFood.standardWeightGrams) || 100,
              confidence: 1.0,
            },
            confidence: 1.0,
            matchStatus: 'EXACT_MATCH',
            primaryMatch: {
              foodItemId: newFood.id,
              name: newFood.name,
              localNames: newFood.localNames,
              brand: newFood.brand,
              cuisine: newFood.cuisine,
              isVerified: newFood.isVerified,
              isCustom: newFood.isCustom,
              score: 1.0,
              source: newFood.source,
              servingConversions: newFood.servingConversions.map(c => ({
                id: c.id,
                unitName: c.unitName,
                servingDescription: c.servingDescription,
                gramWeight: Number(c.gramWeight),
                isDefault: c.isDefault,
              })),
            },
            alternativeMatches: [],
          });
        }
      }
    }

    // Recalculate deterministic nutrition for all updated items
    const calculatedItems: CalculatedItemResult[] = [];
    const matchedFoodIds: string[] = [];

    for (const cand of currentCandidates) {
      if (cand.primaryMatch?.foodItemId) {
        matchedFoodIds.push(cand.primaryMatch.foodItemId);
        const food = await this.prisma.foodItem.findUnique({
          where: { id: cand.primaryMatch.foodItemId },
          include: { nutrientProfile: true, servingConversions: true },
        });

        if (food) {
          const calc = this.nutritionService.calculateItemNutrition(
            cand.id,
            food as any,
            cand.portion.quantity,
            cand.portion.unit,
            cand.portion.estimatedGrams,
          );
          calculatedItems.push(calc);

          cand.calculatedNutrients = {
            calories: calc.calories,
            protein: calc.protein,
            carbs: calc.carbs,
            fat: calc.fat,
            fiber: calc.fiber,
            sodium: calc.sodium,
            sugar: calc.sugar,
            micronutrients: calc.micronutrients,
            provenance: 'CALCULATED_BACKEND_USER_CORRECTED',
          };
        }
      }
    }

    const recalculatedNutrition = this.nutritionService.aggregateMealNutrition(calculatedItems);

    // Append to userCorrections audit log (never overwrite original detectedItems)
    const existingCorrections = (scan.userCorrections as any[]) || [];
    const updatedCorrections = [
      ...existingCorrections,
      {
        submittedAt: new Date().toISOString(),
        items: corrections.items,
      },
    ];

    const updated = await this.prisma.foodScanLog.update({
      where: { id: scanId },
      data: {
        userEdited: true,
        userCorrections: updatedCorrections as any,
        matchedFoodIds,
        nutritionResult: recalculatedNutrition as any,
      },
    });

    // Merge active corrected candidates into response while preserving original detected items in database
    return this.mapToDetailResponse(updated, undefined, currentCandidates);
  }

  /**
   * Confirms the scan and creates a MealEntry and MealFoodItems in the food diary.
   * Idempotent: If already confirmed, returns existing entry without duplicate creation.
   */
  async confirmScan(
    scanId: string,
    userId: string,
    confirmInput?: ConfirmScanRequest,
  ): Promise<ConfirmScanResponse> {
    const scan = await this.prisma.foodScanLog.findUnique({
      where: { id: scanId },
      include: { mealEntry: { include: { items: true } } },
    });

    if (!scan) {
      throw new DomainValidationError(`Scan not found: ${scanId}`);
    }

    if (scan.userId !== userId) {
      throw new DomainValidationError('Unauthorized: Scan belongs to another user.');
    }

    // Idempotency: If already completed with a linked meal entry, return immediately
    if (scan.status === 'COMPLETED' && scan.mealEntryId && scan.mealEntry) {
      return {
        scanId,
        status: 'COMPLETED' as any,
        mealEntryId: scan.mealEntryId,
        totalCalories: Number(scan.mealEntry.totalCalories),
        totalProtein: Number(scan.mealEntry.totalProtein),
        totalCarbs: Number(scan.mealEntry.totalCarbs),
        totalFat: Number(scan.mealEntry.totalFat),
        itemCount: scan.mealEntry.items.length,
        confirmedAt: scan.confirmedAt?.toISOString() || new Date().toISOString(),
      };
    }

    if (scan.status !== 'NEEDS_REVIEW') {
      throw new DomainValidationError(
        `Cannot confirm scan in status '${scan.status}'. Scan must be reviewed before confirmation.`,
      );
    }

    // Resolve candidates (taking into account user corrections if edited)
    const detected = (scan.detectedItems as any[]) || [];
    if (detected.length === 0) {
      throw new DomainValidationError('Cannot confirm an empty scan with zero food items.');
    }

    const mealDateStr = confirmInput?.date || new Date().toISOString().split('T')[0]!;
    const mealDate = new Date(`${mealDateStr}T00:00:00.000Z`);
    const mealType = confirmInput?.mealType || scan.mealType || 'LUNCH';

    // Calculate item nutrition deterministically for all items
    const foodItemsToInsert: Array<{
      foodItemId: string | null;
      foodName: string;
      portionAmount: number;
      servingUnit: string;
      gramWeight: number;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      confidenceScore: number;
    }> = [];

    for (const cand of detected) {
      let calories = 0;
      let protein = 0;
      let carbs = 0;
      let fat = 0;
      let gramWeight = cand.portion.estimatedGrams || 100;

      if (cand.calculatedNutrients) {
        calories = cand.calculatedNutrients.calories;
        protein = cand.calculatedNutrients.protein;
        carbs = cand.calculatedNutrients.carbs;
        fat = cand.calculatedNutrients.fat;
      } else if (cand.primaryMatch?.foodItemId) {
        const food = await this.prisma.foodItem.findUnique({
          where: { id: cand.primaryMatch.foodItemId },
          include: { nutrientProfile: true, servingConversions: true },
        });
        if (food) {
          const calc = this.nutritionService.calculateItemNutrition(
            cand.id,
            food as any,
            cand.portion.quantity,
            cand.portion.unit,
            cand.portion.estimatedGrams,
          );
          calories = calc.calories;
          protein = calc.protein;
          carbs = calc.carbs;
          fat = calc.fat;
          gramWeight = calc.resolvedGramWeight;
        }
      }

      foodItemsToInsert.push({
        foodItemId: cand.primaryMatch?.foodItemId || null,
        foodName: cand.name,
        portionAmount: cand.portion.quantity,
        servingUnit: cand.portion.unit,
        gramWeight,
        calories,
        protein,
        carbs,
        fat,
        confidenceScore: cand.confidence || 0.9,
      });
    }

    // Atomic transaction: find/create MealEntry, insert MealFoodItems, update scan
    const result = await this.prisma.$transaction(async tx => {
      // Find or create MealEntry for (userId, date, mealType)
      let mealEntry = await tx.mealEntry.findUnique({
        where: {
          userId_date_mealType: {
            userId,
            date: mealDate,
            mealType: mealType as any,
          },
        },
      });

      if (!mealEntry) {
        mealEntry = await tx.mealEntry.create({
          data: {
            userId,
            date: mealDate,
            mealType: mealType as any,
            notes: confirmInput?.notes || 'Logged via AI Photo Scan',
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
          },
        });
      }

      // Insert all MealFoodItems
      let addedCalories = 0;
      let addedProtein = 0;
      let addedCarbs = 0;
      let addedFat = 0;

      for (const item of foodItemsToInsert) {
        await tx.mealFoodItem.create({
          data: {
            mealEntryId: mealEntry.id,
            foodItemId: item.foodItemId,
            foodName: item.foodName,
            portionAmount: item.portionAmount,
            servingUnit: item.servingUnit,
            gramWeight: item.gramWeight,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            confidenceScore: item.confidenceScore,
            loggedMethod: 'AI_PHOTO',
          },
        });

        addedCalories += item.calories;
        addedProtein += item.protein;
        addedCarbs += item.carbs;
        addedFat += item.fat;
      }

      // Update MealEntry totals
      const updatedTotalCalories = Number(mealEntry.totalCalories) + addedCalories;
      const updatedTotalProtein = Number(mealEntry.totalProtein) + addedProtein;
      const updatedTotalCarbs = Number(mealEntry.totalCarbs) + addedCarbs;
      const updatedTotalFat = Number(mealEntry.totalFat) + addedFat;

      await tx.mealEntry.update({
        where: { id: mealEntry.id },
        data: {
          totalCalories: updatedTotalCalories,
          totalProtein: updatedTotalProtein,
          totalCarbs: updatedTotalCarbs,
          totalFat: updatedTotalFat,
        },
      });

      // Update scan log
      const confirmedAt = new Date();
      await tx.foodScanLog.update({
        where: { id: scanId },
        data: {
          status: 'COMPLETED',
          confirmedAt,
          mealEntryId: mealEntry.id,
        },
      });

      return {
        scanId,
        status: 'COMPLETED' as any,
        mealEntryId: mealEntry.id,
        totalCalories: updatedTotalCalories,
        totalProtein: updatedTotalProtein,
        totalCarbs: updatedTotalCarbs,
        totalFat: updatedTotalFat,
        itemCount: foodItemsToInsert.length,
        confirmedAt: confirmedAt.toISOString(),
      };
    });

    return result;
  }

  /**
   * Cancels an eligible scan session.
   */
  async cancelScan(scanId: string, userId: string): Promise<CancelScanResponse> {
    const scan = await this.prisma.foodScanLog.findUnique({
      where: { id: scanId },
    });

    if (!scan) {
      throw new DomainValidationError(`Scan not found: ${scanId}`);
    }

    if (scan.userId !== userId) {
      throw new DomainValidationError('Unauthorized: Scan belongs to another user.');
    }

    if (scan.status === 'COMPLETED') {
      throw new DomainValidationError('Cannot cancel an already confirmed and completed scan.');
    }

    const cancelledAt = new Date();
    await this.prisma.foodScanLog.update({
      where: { id: scanId },
      data: {
        status: 'CANCELLED',
        cancelledAt,
      },
    });

    return {
      scanId,
      status: 'CANCELLED' as any,
      message: 'Scan cancelled successfully.',
      cancelledAt: cancelledAt.toISOString(),
    };
  }

  private mapToDetailResponse(
    scan: any,
    uncertaintyNotes?: string[],
    overrideItems?: FoodCandidate[],
  ): ScanDetailResponse {
    const detectedItems = overrideItems || (scan.detectedItems as FoodCandidate[]) || [];
    const nutritionResult = (scan.nutritionResult as any) || undefined;

    return {
      scanId: scan.id,
      userId: scan.userId,
      status: scan.status as any,
      storageKey: scan.storageKey,
      mimeType: scan.mimeType,
      fileSizeBytes: scan.fileSizeBytes,
      imageWidth: scan.imageWidth,
      imageHeight: scan.imageHeight,
      provider: scan.provider,
      model: scan.model,
      latencyMs: scan.latencyMs || 0,
      detectedItems,
      userCorrections: (scan.userCorrections as any[]) || [],
      nutritionResult:
        nutritionResult && Object.keys(nutritionResult).length > 0
          ? {
              calories: Number(nutritionResult.calories) || 0,
              protein: Number(nutritionResult.protein) || 0,
              carbs: Number(nutritionResult.carbs) || 0,
              fat: Number(nutritionResult.fat) || 0,
              fiber: nutritionResult.fiber != null ? Number(nutritionResult.fiber) : null,
              sodium: nutritionResult.sodium != null ? Number(nutritionResult.sodium) : null,
              sugar: nutritionResult.sugar != null ? Number(nutritionResult.sugar) : null,
              micronutrients: nutritionResult.micronutrients || {},
              itemCount: Number(nutritionResult.itemCount) || detectedItems.length,
            }
          : undefined,
      uncertaintyNotes: uncertaintyNotes || [
        'Visual portion estimation carries inherent uncertainty. Confirm portions before adding to diary.',
      ],
      errorMessage: scan.errorMessage,
      failureReason: scan.failureReason,
      mealType: scan.mealType as any,
      mealEntryId: scan.mealEntryId,
      userEdited: Boolean(scan.userEdited),
      uploadedAt: scan.uploadedAt?.toISOString() || null,
      processedAt: scan.processedAt?.toISOString() || null,
      confirmedAt: scan.confirmedAt?.toISOString() || null,
      cancelledAt: scan.cancelledAt?.toISOString() || null,
      createdAt: scan.createdAt.toISOString(),
      updatedAt: scan.updatedAt.toISOString(),
    };
  }
}

export const defaultScanService = new ScanService();
