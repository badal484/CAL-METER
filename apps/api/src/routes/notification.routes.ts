import { Router, type Request, type Response, type NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getFirebaseTokenVerifier, type IFirebaseTokenVerifier } from '../lib/firebase.js';
import { resolveInternalUserId } from '../lib/userResolver.js';
import { ValidationError } from '../lib/errors.js';
import {
  RegisterDeviceTokenSchema,
  DeactivateDeviceTokenSchema,
  UpdateNotificationPreferenceSchema,
  SendTestNotificationSchema,
} from '@calmeter/contracts';
import { DeviceTokenService } from '../services/deviceToken.service.js';
import { NotificationPreferenceService } from '../services/notificationPreference.service.js';
import {
  NotificationDispatcherService,
  type IPushNotificationProvider,
} from '../services/notificationDispatcher.service.js';
import { validateBody } from '../middleware/validate.js';

export interface NotificationRouterOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
  pushProvider?: IPushNotificationProvider;
}

export function createNotificationRoutes(options?: NotificationRouterOptions): Router {
  const router = Router();
  const prisma = options?.prisma || getPrismaClient();
  const verifier = options?.verifier || getFirebaseTokenVerifier();
  const authMiddleware = createAuthMiddleware(verifier);
  const tokenService = new DeviceTokenService(prisma);
  const prefService = new NotificationPreferenceService(prisma);
  const dispatcher = new NotificationDispatcherService(prisma, options?.pushProvider);

  async function getUserId(req: Request): Promise<string> {
    if (!req.user) {
      throw new ValidationError('Authentication required.');
    }
    return resolveInternalUserId(prisma, req.user);
  }

  // POST /api/v1/notifications/device-token
  router.post(
    '/device-token',
    authMiddleware,
    validateBody(RegisterDeviceTokenSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const result = await tokenService.registerToken(userId, req.body);
        return res.status(200).json({
          success: true,
          data: {
            id: result.id,
            platform: result.platform,
            isActive: result.isActive,
            updatedAt: result.updatedAt.toISOString(),
          },
        });
      } catch (err) {
        return next(err);
      }
    },
  );

  // DELETE /api/v1/notifications/device-token
  router.delete(
    '/device-token',
    authMiddleware,
    validateBody(DeactivateDeviceTokenSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        await tokenService.deactivateToken(userId, req.body.token);
        return res.status(200).json({
          success: true,
          data: {
            message: 'Device token deactivated.',
          },
        });
      } catch (err) {
        return next(err);
      }
    },
  );

  // GET /api/v1/notifications/preferences
  router.get(
    '/preferences',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const pref = await prefService.getPreferences(userId);
        return res.status(200).json({
          success: true,
          data: pref,
        });
      } catch (err) {
        return next(err);
      }
    },
  );

  // PATCH /api/v1/notifications/preferences
  router.patch(
    '/preferences',
    authMiddleware,
    validateBody(UpdateNotificationPreferenceSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const updated = await prefService.updatePreferences(userId, req.body);
        return res.status(200).json({
          success: true,
          data: updated,
        });
      } catch (err) {
        return next(err);
      }
    },
  );

  // GET /api/v1/notifications/history
  router.get(
    '/history',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const limit = Number.parseInt(req.query.limit as string, 10) || 50;
        const history = await dispatcher.getHistory(userId, limit);
        return res.status(200).json({
          success: true,
          data: {
            notifications: history,
            total: history.length,
          },
        });
      } catch (err) {
        return next(err);
      }
    },
  );

  // POST /api/v1/notifications/test
  router.post(
    '/test',
    authMiddleware,
    validateBody(SendTestNotificationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const result = await dispatcher.dispatchNotification({
          userId,
          category: req.body.category,
          title: req.body.title || 'CAL METER Test Notification',
          body: req.body.body || 'This is a test notification from CAL METER.',
          bypassQuietHours: true,
        });

        return res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    },
  );

  return router;
}
