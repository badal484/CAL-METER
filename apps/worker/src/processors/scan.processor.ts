import type { Job } from 'bullmq';
import type { FoodScanJobData, FoodScanJobResult } from '../queues/scan.queue.js';
import { workerLogger } from '../lib/logger.js';

export async function processFoodScanJob(
  job: Job<FoodScanJobData, FoodScanJobResult>,
): Promise<FoodScanJobResult> {
  const { scanId, userId, storageKey } = job.data;

  workerLogger.info(
    { jobId: job.id, scanId, userId, storageKey, attempt: job.attemptsMade + 1 },
    'Processing food scan job (infrastructure placeholder)',
  );

  // Milestone 4 will integrate the actual multimodal AI vision pipeline
  return {
    success: true,
    scanId,
    detectedItemCount: 0,
  };
}
