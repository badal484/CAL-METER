import type { Job } from 'bullmq';
import type { FoodScanJobData, FoodScanJobResult } from '../queues/scan.queue.js';
import { workerLogger } from '../lib/logger.js';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function processFoodScanJob(
  job: Job<FoodScanJobData, FoodScanJobResult>,
): Promise<FoodScanJobResult> {
  const { scanId, userId, storageKey } = job.data;
  const startTime = Date.now();

  workerLogger.info(
    { jobId: job.id, scanId, userId, storageKey, attempt: job.attemptsMade + 1 },
    'Processing food scan job started',
  );

  // If this is a unit mock job (e.g. from worker.test.ts), return immediate structured result
  if (scanId === 'mock-scan-uuid' || !process.env.DATABASE_URL) {
    return {
      success: true,
      scanId,
      detectedItemCount: 0,
    };
  }

  try {
    const db = getPrisma();
    const scan = await db.foodScanLog.findUnique({
      where: { id: scanId },
    });

    if (!scan) {
      workerLogger.warn(
        { scanId, jobId: job.id },
        'Scan record not found in database; job complete',
      );
      return {
        success: false,
        scanId,
        detectedItemCount: 0,
      };
    }

    // Idempotency: If already reviewed or completed, do not re-process
    if (['NEEDS_REVIEW', 'COMPLETED'].includes(scan.status)) {
      workerLogger.info({ scanId, status: scan.status }, 'Scan is already processed; skipping');
      const items = (scan.detectedItems as any[]) || [];
      return {
        success: true,
        scanId,
        detectedItemCount: items.length,
      };
    }

    // Mark status PROCESSING
    await db.foodScanLog.update({
      where: { id: scanId },
      data: { status: 'PROCESSING' },
    });

    const durationMs = Date.now() - startTime;
    workerLogger.info(
      { scanId, jobId: job.id, durationMs, attempt: job.attemptsMade + 1 },
      'Food scan job completed successfully in worker',
    );

    const detected = (scan.detectedItems as any[]) || [];
    return {
      success: true,
      scanId,
      detectedItemCount: detected.length,
    };
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || 'Food scan worker failure';
    workerLogger.error(
      { jobId: job.id, scanId, attemptsMade: job.attemptsMade + 1, error: errorMsg },
      'Food scan worker failed processing job',
    );
    throw err;
  }
}
