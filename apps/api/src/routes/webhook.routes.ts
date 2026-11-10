import { Router, Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { RevenueCatWebhookService } from '../services/revenueCatWebhook.service.js';
import { RevenueCatWebhookPayloadSchema } from '@calmeter/contracts';

export interface WebhookRouterOptions {
  prisma?: PrismaClient;
  webhookService?: RevenueCatWebhookService;
}

export function createWebhookRouter(options?: WebhookRouterOptions): Router {
  const router = Router();
  const prisma = options?.prisma || getPrismaClient();
  const webhookService = options?.webhookService || new RevenueCatWebhookService(prisma);

  /**
   * POST /webhooks/revenuecat
   * Receives and processes real-time server-to-server subscription lifecycle events.
   */
  router.post('/revenuecat', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Verify webhook authorization header
      webhookService.verifyWebhookAuth(req.headers.authorization);

      // 2. Validate event payload
      const parsed = RevenueCatWebhookPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      // 3. Process event idempotently
      const result = await webhookService.processWebhookEvent(parsed.data);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
