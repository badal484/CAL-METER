import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { ValidationError } from '../lib/errors.js';

export class TrackingService {
  constructor(private prisma: PrismaClient = getPrismaClient()) {}

  /**
   * Logs a body weight measurement and updates the user's active profile current weight.
   */
  async logWeight(
    userId: string,
    weightKg: number,
    notes?: string,
  ): Promise<{
    id: string;
    userId: string;
    weightKg: number;
    loggedAt: string;
    notes?: string | null;
  }> {
    if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 350) {
      throw new ValidationError(
        'Weight measurement must be a finite number between 30 kg and 350 kg.',
      );
    }

    const result = await this.prisma.$transaction(async tx => {
      const log = await tx.weightLog.create({
        data: {
          userId,
          weightKg,
          notes,
        },
      });

      // Keep user profile's current weight in sync
      await tx.userProfile.updateMany({
        where: { userId },
        data: { currentWeightKg: weightKg },
      });

      return log;
    });

    return {
      id: result.id,
      userId: result.userId,
      weightKg: Number(result.weightKg),
      loggedAt: result.loggedAt.toISOString(),
      notes: result.notes,
    };
  }

  /**
   * Retrieves historical weight logs for the user ordered by loggedAt descending.
   */
  async getWeightHistory(
    userId: string,
    limit = 50,
  ): Promise<
    Array<{ id: string; userId: string; weightKg: number; loggedAt: string; notes?: string | null }>
  > {
    const logs = await this.prisma.weightLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: Math.min(limit, 200),
    });

    return logs.map(l => ({
      id: l.id,
      userId: l.userId,
      weightKg: Number(l.weightKg),
      loggedAt: l.loggedAt.toISOString(),
      notes: l.notes,
    }));
  }
}
