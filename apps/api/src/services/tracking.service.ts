import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import {
  formatDateToIso,
  parseIsoDate,
  roundTo,
  calculateExerciseCalories,
  ExerciseCategory,
  ExerciseIntensity,
  CalorieEstimateSource,
} from '@calmeter/shared';
import type {
  LogWeightDto,
  UpdateWeightLogDto,
  WeightLogDto,
  WeightProgressSummaryDto,
  LogWaterDto,
  UpdateWaterLogDto,
  WaterLogDto,
  DailyWaterSummaryDto,
  LogExerciseDto,
  UpdateExerciseLogDto,
  ExerciseLogDto,
  ProgressQueryDto,
  ProgressReportDto,
} from '@calmeter/contracts';

export class TrackingService {
  constructor(private prisma: PrismaClient = getPrismaClient()) {}

  // ============================================================================
  // 1. WEIGHT TRACKING
  // ============================================================================

  /**
   * Logs a body weight measurement and updates the user's active profile current weight.
   * Includes idempotency protection against rapid retry duplicate submissions.
   */
  async logWeight(userId: string, data: LogWeightDto): Promise<WeightLogDto> {
    const { weightKg, loggedAt: loggedAtInput, notes, source = 'MANUAL' } = data;

    if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 350) {
      throw new ValidationError(
        'Weight measurement must be a finite number between 30 kg and 350 kg.',
      );
    }

    const effectiveLoggedAt = loggedAtInput ? new Date(loggedAtInput) : new Date();

    // Idempotency check: if user submitted an identical weight within the last 10 seconds, return existing
    const recentDuplicate = await this.prisma.weightLog.findFirst({
      where: {
        userId,
        weightKg,
        loggedAt: {
          gte: new Date(effectiveLoggedAt.getTime() - 10000),
          lte: new Date(effectiveLoggedAt.getTime() + 10000),
        },
      },
    });

    if (recentDuplicate) {
      return this.mapWeightLogToDto(recentDuplicate);
    }

    const result = await this.prisma.$transaction(async tx => {
      const log = await tx.weightLog.create({
        data: {
          userId,
          weightKg,
          loggedAt: effectiveLoggedAt,
          notes,
          source,
        },
      });

      // Find the latest weight log for this user to ensure profile reflects the true latest measurement
      const latestLog = await tx.weightLog.findFirst({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
      });

      if (latestLog && latestLog.id === log.id) {
        await tx.userProfile.updateMany({
          where: { userId },
          data: { currentWeightKg: weightKg },
        });
      }

      return log;
    });

    return this.mapWeightLogToDto(result);
  }

  /**
   * Retrieves historical weight logs for the user ordered by loggedAt descending.
   */
  async getWeightHistory(
    userId: string,
    options?: { startDate?: string; endDate?: string; limit?: number },
  ): Promise<WeightLogDto[]> {
    const where: any = { userId };

    if (options?.startDate || options?.endDate) {
      where.loggedAt = {};
      if (options.startDate) {
        where.loggedAt.gte = parseIsoDate(options.startDate);
      }
      if (options.endDate) {
        const end = parseIsoDate(options.endDate);
        end.setUTCHours(23, 59, 59, 999);
        where.loggedAt.lte = end;
      }
    }

    const logs = await this.prisma.weightLog.findMany({
      where,
      orderBy: { loggedAt: 'desc' },
      take: Math.min(options?.limit ?? 100, 500),
    });

    return logs.map(l => this.mapWeightLogToDto(l));
  }

  /**
   * Updates an existing weight measurement.
   */
  async updateWeightLog(
    userId: string,
    id: string,
    data: UpdateWeightLogDto,
  ): Promise<WeightLogDto> {
    const existing = await this.prisma.weightLog.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundError('Weight measurement record not found.');
    }

    if (
      data.weightKg !== undefined &&
      (!Number.isFinite(data.weightKg) || data.weightKg < 30 || data.weightKg > 350)
    ) {
      throw new ValidationError(
        'Weight measurement must be a finite number between 30 kg and 350 kg.',
      );
    }

    const updated = await this.prisma.$transaction(async tx => {
      const record = await tx.weightLog.update({
        where: { id },
        data: {
          weightKg: data.weightKg !== undefined ? data.weightKg : undefined,
          notes: data.notes !== undefined ? data.notes : undefined,
          loggedAt: data.loggedAt ? new Date(data.loggedAt) : undefined,
        },
      });

      // Re-sync user profile current weight with latest measurement
      const latest = await tx.weightLog.findFirst({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
      });

      if (latest) {
        await tx.userProfile.updateMany({
          where: { userId },
          data: { currentWeightKg: latest.weightKg },
        });
      }

      return record;
    });

    return this.mapWeightLogToDto(updated);
  }

  /**
   * Deletes a weight measurement.
   */
  async deleteWeightLog(
    userId: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.weightLog.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundError('Weight measurement record not found.');
    }

    await this.prisma.$transaction(async tx => {
      await tx.weightLog.delete({
        where: { id },
      });

      // Synchronize latest remaining weight to user profile
      const latest = await tx.weightLog.findFirst({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
      });

      if (latest) {
        await tx.userProfile.updateMany({
          where: { userId },
          data: { currentWeightKg: latest.weightKg },
        });
      }
    });

    return { success: true, message: 'Weight measurement deleted successfully.' };
  }

  /**
   * Derives weight statistics and trends across a time window.
   */
  async getWeightSummary(
    userId: string,
    options?: { startDate?: string; endDate?: string },
  ): Promise<WeightProgressSummaryDto> {
    const history = await this.getWeightHistory(userId, options);
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { currentWeightKg: true, targetWeightKg: true },
    });

    const currentWeightKg = profile?.currentWeightKg
      ? Number(profile.currentWeightKg)
      : (history[0]?.weightKg ?? 70);
    const targetWeightKg = profile?.targetWeightKg ? Number(profile.targetWeightKg) : null;

    if (history.length === 0) {
      return {
        currentWeightKg,
        startWeightKg: null,
        previousWeightKg: null,
        targetWeightKg,
        netChangeKg: null,
        progressPercentage: null,
        minWeightKg: null,
        maxWeightKg: null,
        trend: 'INSUFFICIENT_DATA',
        history: [],
      };
    }

    // history is sorted desc (history[0] is latest, history[history.length - 1] is earliest)
    const latestMeasurement = history[0]!;
    const previousMeasurement = history.length > 1 ? (history[1] ?? null) : null;
    const earliestMeasurement = history[history.length - 1]!;

    const weights = history.map(h => h.weightKg);
    const minWeightKg = Math.min(...weights);
    const maxWeightKg = Math.max(...weights);

    const startWeightKg = earliestMeasurement.weightKg;
    const netChangeKg = roundTo(latestMeasurement.weightKg - startWeightKg, 2);

    let progressPercentage: number | null = null;
    if (targetWeightKg !== null && startWeightKg !== targetWeightKg) {
      const totalDeltaNeeded = targetWeightKg - startWeightKg;
      const actualDeltaAchieved = latestMeasurement.weightKg - startWeightKg;
      progressPercentage = roundTo(
        Math.min(Math.max((actualDeltaAchieved / totalDeltaNeeded) * 100, 0), 100),
        1,
      );
    }

    let trend: 'LOSING' | 'GAINING' | 'MAINTAINING' | 'INSUFFICIENT_DATA' = 'INSUFFICIENT_DATA';
    if (history.length >= 2) {
      if (netChangeKg < -0.2) trend = 'LOSING';
      else if (netChangeKg > 0.2) trend = 'GAINING';
      else trend = 'MAINTAINING';
    }

    return {
      currentWeightKg: latestMeasurement.weightKg,
      startWeightKg,
      previousWeightKg: previousMeasurement ? previousMeasurement.weightKg : null,
      targetWeightKg,
      netChangeKg,
      progressPercentage,
      minWeightKg,
      maxWeightKg,
      trend,
      history,
    };
  }

  // ============================================================================
  // 2. WATER TRACKING
  // ============================================================================

  /**
   * Logs water intake in milliliters.
   */
  async logWater(userId: string, data: LogWaterDto): Promise<WaterLogDto> {
    const { amountMl, date: dateStr, loggedAt: loggedAtInput, source = 'MANUAL' } = data;

    if (!Number.isInteger(amountMl) || amountMl <= 0 || amountMl > 5000) {
      throw new ValidationError('Water intake amount must be a positive integer up to 5,000 ml.');
    }

    const effectiveLoggedAt = loggedAtInput ? new Date(loggedAtInput) : new Date();
    const effectiveDate = dateStr
      ? parseIsoDate(dateStr)
      : parseIsoDate(formatDateToIso(effectiveLoggedAt));

    const created = await this.prisma.waterLog.create({
      data: {
        userId,
        date: effectiveDate,
        amountMl,
        loggedAt: effectiveLoggedAt,
        source,
      },
    });

    return this.mapWaterLogToDto(created);
  }

  /**
   * Retrieves water log entries for a specific calendar date (YYYY-MM-DD).
   */
  async getWaterEntriesForDate(userId: string, dateStr: string): Promise<WaterLogDto[]> {
    const date = parseIsoDate(dateStr);
    const logs = await this.prisma.waterLog.findMany({
      where: { userId, date },
      orderBy: { loggedAt: 'desc' },
    });

    return logs.map(l => this.mapWaterLogToDto(l));
  }

  /**
   * Retrieves daily water progress and summary against target.
   */
  async getWaterSummaryForDate(userId: string, dateStr: string): Promise<DailyWaterSummaryDto> {
    const date = parseIsoDate(dateStr);
    const entries = await this.getWaterEntriesForDate(userId, dateStr);

    const totalMl = entries.reduce((sum, e) => sum + e.amountMl, 0);

    // Retrieve active goal water target effective on this date
    const goal = await this.prisma.nutritionGoal.findFirst({
      where: {
        userId,
        effectiveDate: { lte: date },
      },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      select: { waterMl: true },
    });

    const targetMl = goal?.waterMl ?? 2500;
    const percentage = targetMl > 0 ? roundTo((totalMl / targetMl) * 100, 1) : 0;

    return {
      date: dateStr,
      totalMl,
      targetMl,
      percentage,
      entries,
      disclaimer:
        'Daily water targets are general lifestyle references and vary based on climate, perspiration, and physical activity. They are not medical prescriptions.',
    };
  }

  /**
   * Updates an existing water log entry.
   */
  async updateWaterLog(userId: string, id: string, data: UpdateWaterLogDto): Promise<WaterLogDto> {
    const existing = await this.prisma.waterLog.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundError('Water log entry not found.');
    }

    if (
      data.amountMl !== undefined &&
      (!Number.isInteger(data.amountMl) || data.amountMl <= 0 || data.amountMl > 5000)
    ) {
      throw new ValidationError('Water intake amount must be a positive integer up to 5,000 ml.');
    }

    const updated = await this.prisma.waterLog.update({
      where: { id },
      data: {
        amountMl: data.amountMl !== undefined ? data.amountMl : undefined,
        date: data.date ? parseIsoDate(data.date) : undefined,
      },
    });

    return this.mapWaterLogToDto(updated);
  }

  /**
   * Deletes a water log entry.
   */
  async deleteWaterLog(userId: string, id: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.waterLog.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundError('Water log entry not found.');
    }

    await this.prisma.waterLog.delete({
      where: { id },
    });

    return { success: true, message: 'Water log entry deleted successfully.' };
  }

  // ============================================================================
  // 3. EXERCISE TRACKING
  // ============================================================================

  /**
   * Logs a physical exercise activity.
   */
  async logExercise(userId: string, data: LogExerciseDto): Promise<ExerciseLogDto> {
    const {
      name,
      category,
      durationMinutes,
      performedAt: performedAtInput,
      date: dateInput,
      distanceKm,
      intensity = ExerciseIntensity.MODERATE,
      notes,
      estimateCalories = false,
    } = data;

    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
      throw new ValidationError(
        'Exercise duration must be an integer between 1 and 1,440 minutes.',
      );
    }

    const effectivePerformedAt = performedAtInput ? new Date(performedAtInput) : new Date();
    const effectiveDate = dateInput
      ? parseIsoDate(dateInput)
      : parseIsoDate(formatDateToIso(effectivePerformedAt));

    let finalCalories: number | undefined = data.caloriesBurned;
    let calorieSource: CalorieEstimateSource | undefined =
      finalCalories !== undefined ? CalorieEstimateSource.MANUAL_ENTRY : undefined;
    let metValue: number | undefined = undefined;

    if (estimateCalories && finalCalories === undefined) {
      // Look up user's current weight from profile for MET calculation
      const profile = await this.prisma.userProfile.findUnique({
        where: { userId },
        select: { currentWeightKg: true },
      });

      const weightKg = profile?.currentWeightKg ? Number(profile.currentWeightKg) : 70;

      const calc = calculateExerciseCalories({
        category,
        durationMinutes,
        weightKg,
        intensity,
      });

      finalCalories = calc.caloriesBurned;
      calorieSource = calc.source;
      metValue = calc.metValue;
    }

    const created = await this.prisma.exerciseLog.create({
      data: {
        userId,
        name: name.trim(),
        category,
        durationMinutes,
        performedAt: effectivePerformedAt,
        date: effectiveDate,
        distanceKm,
        intensity,
        caloriesBurned: finalCalories,
        calorieSource,
        metValue,
        notes,
      },
    });

    return this.mapExerciseLogToDto(created);
  }

  /**
   * Retrieves exercise activities for a user with optional date filtering.
   */
  async getExercises(
    userId: string,
    options?: { date?: string; startDate?: string; endDate?: string; limit?: number },
  ): Promise<ExerciseLogDto[]> {
    const where: any = { userId };

    if (options?.date) {
      where.date = parseIsoDate(options.date);
    } else if (options?.startDate || options?.endDate) {
      where.date = {};
      if (options.startDate) {
        where.date.gte = parseIsoDate(options.startDate);
      }
      if (options.endDate) {
        where.date.lte = parseIsoDate(options.endDate);
      }
    }

    const logs = await this.prisma.exerciseLog.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      take: Math.min(options?.limit ?? 100, 500),
    });

    return logs.map(l => this.mapExerciseLogToDto(l));
  }

  /**
   * Updates an existing exercise activity.
   */
  async updateExerciseLog(
    userId: string,
    id: string,
    data: UpdateExerciseLogDto,
  ): Promise<ExerciseLogDto> {
    const existing = await this.prisma.exerciseLog.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundError('Exercise log entry not found.');
    }

    if (
      data.durationMinutes !== undefined &&
      (!Number.isInteger(data.durationMinutes) ||
        data.durationMinutes <= 0 ||
        data.durationMinutes > 1440)
    ) {
      throw new ValidationError(
        'Exercise duration must be an integer between 1 and 1,440 minutes.',
      );
    }

    const updated = await this.prisma.exerciseLog.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        category: data.category !== undefined ? data.category : undefined,
        durationMinutes: data.durationMinutes !== undefined ? data.durationMinutes : undefined,
        performedAt: data.performedAt ? new Date(data.performedAt) : undefined,
        date: data.date ? parseIsoDate(data.date) : undefined,
        distanceKm: data.distanceKm !== undefined ? data.distanceKm : undefined,
        intensity: data.intensity !== undefined ? data.intensity : undefined,
        caloriesBurned: data.caloriesBurned !== undefined ? data.caloriesBurned : undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
      },
    });

    return this.mapExerciseLogToDto(updated);
  }

  /**
   * Deletes an exercise activity.
   */
  async deleteExerciseLog(
    userId: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.exerciseLog.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundError('Exercise log entry not found.');
    }

    await this.prisma.exerciseLog.delete({
      where: { id },
    });

    return { success: true, message: 'Exercise activity deleted successfully.' };
  }

  // ============================================================================
  // 4. PROGRESS REPORT AGGREGATION
  // ============================================================================

  /**
   * Generates a comprehensive multi-metric progress report over a time window.
   */
  async getProgressReport(userId: string, query: ProgressQueryDto): Promise<ProgressReportDto> {
    const now = new Date();
    let startDate: string;
    const endDate: string = query.endDate || formatDateToIso(now);

    if (query.days) {
      const past = new Date(now.getTime() - (query.days - 1) * 24 * 60 * 60 * 1000);
      startDate = formatDateToIso(past);
    } else {
      startDate =
        query.startDate || formatDateToIso(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
    }

    // 1. Weight summary
    const weightSummary = await this.getWeightSummary(userId, { startDate, endDate });

    // 2. Water summary
    const startIso = parseIsoDate(startDate);
    const endIso = parseIsoDate(endDate);

    const waterLogs = await this.prisma.waterLog.findMany({
      where: {
        userId,
        date: { gte: startIso, lte: endIso },
      },
    });

    // Group water by date
    const waterDailyMap = new Map<string, number>();
    for (const w of waterLogs) {
      const dStr = formatDateToIso(w.date);
      waterDailyMap.set(dStr, (waterDailyMap.get(dStr) ?? 0) + w.amountMl);
    }

    // Get active goal water target
    const currentGoal = await this.prisma.nutritionGoal.findFirst({
      where: { userId, effectiveDate: { lte: endIso } },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      select: { waterMl: true },
    });
    const targetMl = currentGoal?.waterMl ?? 2500;

    let totalWaterAcrossDays = 0;
    let daysTargetMet = 0;
    for (const dailyMl of waterDailyMap.values()) {
      totalWaterAcrossDays += dailyMl;
      if (dailyMl >= targetMl) {
        daysTargetMet++;
      }
    }

    const daysTracked = waterDailyMap.size;
    const averageDailyMl = daysTracked > 0 ? roundTo(totalWaterAcrossDays / daysTracked, 0) : 0;
    const adherenceRate = daysTracked > 0 ? roundTo((daysTargetMet / daysTracked) * 100, 1) : 0;

    // 3. Exercise summary
    const exerciseLogs = await this.getExercises(userId, { startDate, endDate, limit: 500 });
    const totalSessions = exerciseLogs.length;
    let totalDurationMinutes = 0;
    let totalCaloriesBurned = 0;
    const sessionsByCategory: Record<string, number> = {};

    for (const ex of exerciseLogs) {
      totalDurationMinutes += ex.durationMinutes;
      if (ex.caloriesBurned) {
        totalCaloriesBurned += ex.caloriesBurned;
      }
      sessionsByCategory[ex.category] = (sessionsByCategory[ex.category] ?? 0) + 1;
    }

    const disclaimers = [
      'Weight variations of ±0.5–1.5 kg over 24–48 hours are normal and largely reflect water retention, sodium intake, and glycogen storage rather than body fat changes.',
      'Exercise calories are statistical approximations and are NOT added to your food calorie budget to maintain predictable energy balance.',
      'Daily water targets are general wellness baselines and do not constitute personalized medical advice.',
    ];

    return {
      startDate,
      endDate,
      weight: weightSummary,
      water: {
        averageDailyMl,
        daysTracked,
        targetMl,
        adherenceRate,
      },
      exercise: {
        totalSessions,
        totalDurationMinutes,
        totalCaloriesBurned: roundTo(totalCaloriesBurned, 0),
        sessionsByCategory,
      },
      disclaimers,
    };
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapWeightLogToDto(log: any): WeightLogDto {
    return {
      id: log.id,
      userId: log.userId,
      weightKg: Number(log.weightKg),
      loggedAt:
        log.loggedAt instanceof Date
          ? log.loggedAt.toISOString()
          : new Date(log.loggedAt).toISOString(),
      notes: log.notes ?? null,
      source: log.source ?? 'MANUAL',
      updatedAt: log.updatedAt
        ? log.updatedAt instanceof Date
          ? log.updatedAt.toISOString()
          : new Date(log.updatedAt).toISOString()
        : undefined,
    };
  }

  private mapWaterLogToDto(log: any): WaterLogDto {
    return {
      id: log.id,
      userId: log.userId,
      date: formatDateToIso(log.date),
      amountMl: log.amountMl,
      loggedAt:
        log.loggedAt instanceof Date
          ? log.loggedAt.toISOString()
          : new Date(log.loggedAt).toISOString(),
      source: log.source ?? 'MANUAL',
      updatedAt: log.updatedAt
        ? log.updatedAt instanceof Date
          ? log.updatedAt.toISOString()
          : new Date(log.updatedAt).toISOString()
        : undefined,
    };
  }

  private mapExerciseLogToDto(log: any): ExerciseLogDto {
    return {
      id: log.id,
      userId: log.userId,
      name: log.name,
      category: log.category as ExerciseCategory,
      durationMinutes: log.durationMinutes,
      performedAt:
        log.performedAt instanceof Date
          ? log.performedAt.toISOString()
          : new Date(log.performedAt).toISOString(),
      date: formatDateToIso(log.date),
      distanceKm:
        log.distanceKm !== null && log.distanceKm !== undefined ? Number(log.distanceKm) : null,
      intensity: log.intensity as ExerciseIntensity,
      caloriesBurned:
        log.caloriesBurned !== null && log.caloriesBurned !== undefined
          ? Number(log.caloriesBurned)
          : null,
      calorieSource: (log.calorieSource as CalorieEstimateSource) ?? null,
      metValue: log.metValue !== null && log.metValue !== undefined ? Number(log.metValue) : null,
      notes: log.notes ?? null,
      createdAt:
        log.createdAt instanceof Date
          ? log.createdAt.toISOString()
          : new Date(log.createdAt).toISOString(),
      updatedAt:
        log.updatedAt instanceof Date
          ? log.updatedAt.toISOString()
          : new Date(log.updatedAt).toISOString(),
    };
  }
}
