import express, { Router, Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { getFirebaseTokenVerifier, type IFirebaseTokenVerifier } from '../lib/firebase.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { resolveInternalUserId } from '../lib/userResolver.js';
import { ScanService } from '../services/scan.service.js';
import { defaultStorageService } from '../storage/storage.service.js';
import {
  CreateScanRequestSchema,
  SubmitScanCorrectionSchema,
  ConfirmScanRequestSchema,
} from '@calmeter/contracts';
import { ValidationError, NotFoundError } from '../lib/errors.js';

export interface ScanRouterOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
  scanService?: ScanService;
}

export function createScanRouter(options?: ScanRouterOptions): Router {
  const router = Router();
  const prisma = options?.prisma || getPrismaClient();
  const verifier = options?.verifier || getFirebaseTokenVerifier();
  const authMiddleware = createAuthMiddleware(verifier);
  const scanService = options?.scanService || new ScanService({ prisma });

  // Middleware to handle raw binary image uploads up to 10MB
  const rawImageParser = express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'],
    limit: '10mb',
  });

  /**
   * Helper to resolve authenticated internal user ID
   */
  async function getUserId(req: Request): Promise<string> {
    if (!req.user) {
      throw new ValidationError('Authentication required.');
    }
    return resolveInternalUserId(prisma, req.user);
  }

  /**
   * POST /scans
   * Creates a new scan session and returns upload credentials.
   */
  router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CreateScanRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const userId = await getUserId(req);
      const scanResponse = await scanService.createScan(userId, parsed.data);

      res.status(201).json({
        success: true,
        data: scanResponse,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /scans/:id/upload-url
   * Re-issues a presigned upload URL for an active scan.
   */
  router.post(
    '/:id/upload-url',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const scanId = req.params.id as string;
        const userId = await getUserId(req);
        const scan = await scanService.getScan(scanId, userId);

        const mimeType = (scan.mimeType as any) || 'image/jpeg';
        const uploadDetails = await defaultStorageService.generatePresignedUploadUrl(
          scan.storageKey,
          mimeType,
          300,
        );

        res.status(200).json({
          success: true,
          data: {
            scanId,
            storageKey: scan.storageKey,
            uploadUrl: uploadDetails.uploadUrl,
            expiresInSeconds: uploadDetails.expiresInSeconds,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /scans/upload?token=...
   * Direct binary upload endpoint using presigned token.
   */
  router.post(
    '/upload',
    rawImageParser,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = req.query.token as string;
        if (!token) {
          throw new ValidationError("Missing upload 'token' query parameter.");
        }

        const tokenData = defaultStorageService.verifyUploadToken(token);
        // Key format: scans/<userId>/<scanId>.<ext>
        const parts = tokenData.storageKey.split('/');
        const userId = parts[1];
        const scanIdWithExt = parts[2];
        const scanId = scanIdWithExt?.split('.')[0];

        if (!userId || !scanId) {
          throw new ValidationError('Malformed storage key from upload token.');
        }

        let buffer: Buffer;
        if (Buffer.isBuffer(req.body)) {
          buffer = req.body;
        } else if (req.body?.imageBase64) {
          buffer = Buffer.from(req.body.imageBase64, 'base64');
        } else {
          throw new ValidationError('No binary image data received in upload payload.');
        }

        const result = await scanService.uploadScanImage(
          scanId,
          userId,
          buffer,
          tokenData.mimeType,
        );

        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /scans/:id/upload
   * Direct binary upload for authenticated user.
   */
  router.post(
    '/:id/upload',
    authMiddleware,
    rawImageParser,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const scanId = req.params.id as string;
        const userId = await getUserId(req);

        let buffer: Buffer;
        if (Buffer.isBuffer(req.body)) {
          buffer = req.body;
        } else if (req.body?.imageBase64) {
          buffer = Buffer.from(req.body.imageBase64, 'base64');
        } else {
          throw new ValidationError('No binary image data received in upload payload.');
        }

        const declaredMimeType = (req.headers['content-type']?.split(';')[0] || '').trim();
        const result = await scanService.uploadScanImage(
          scanId,
          userId,
          buffer,
          declaredMimeType || undefined,
        );

        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /scans/:id/process
   * Submits uploaded scan for AI recognition and matching.
   */
  router.post(
    '/:id/process',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const scanId = req.params.id as string;
        const userId = await getUserId(req);

        // Enqueue scan
        await scanService.enqueueScanProcessing(scanId, userId);

        // Execute recognition pipeline
        const result = await scanService.processScan(scanId);

        res.status(202).json({
          success: true,
          data: {
            scanId,
            status: result.status,
            message: 'Scan processed successfully.',
            scan: result,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /scans/:id
   * Retrieves scan details, recognition candidates, and calculated nutrition.
   */
  router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scanId = req.params.id as string;
      const userId = await getUserId(req);

      const scan = await scanService.getScan(scanId, userId);

      res.status(200).json({
        success: true,
        data: scan,
      });
    } catch (err) {
      // Map domain error to 404 for tenant anti-enumeration
      if (
        (err as Error)?.message?.includes('belongs to another user') ||
        (err as Error)?.message?.includes('not found')
      ) {
        return next(new NotFoundError('Scan not found.'));
      }
      next(err);
    }
  });

  /**
   * PATCH /scans/:id/corrections
   * Submits user corrections and recalculates nutrition.
   */
  router.patch(
    '/:id/corrections',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const scanId = req.params.id as string;
        const userId = await getUserId(req);

        const parsed = SubmitScanCorrectionSchema.safeParse(req.body);
        if (!parsed.success) {
          throw parsed.error;
        }

        const updatedScan = await scanService.applyCorrections(scanId, userId, parsed.data);

        res.status(200).json({
          success: true,
          data: updatedScan,
        });
      } catch (err) {
        if (
          (err as Error)?.message?.includes('belongs to another user') ||
          (err as Error)?.message?.includes('not found')
        ) {
          return next(new NotFoundError('Scan not found.'));
        }
        next(err);
      }
    },
  );

  /**
   * POST /scans/:id/confirm
   * Confirms meal results and creates entry in food diary.
   */
  router.post(
    '/:id/confirm',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const scanId = req.params.id as string;
        const userId = await getUserId(req);

        const parsed = ConfirmScanRequestSchema.safeParse(req.body || {});
        if (!parsed.success) {
          throw parsed.error;
        }

        const confirmedResult = await scanService.confirmScan(scanId, userId, parsed.data);

        res.status(200).json({
          success: true,
          data: confirmedResult,
        });
      } catch (err) {
        if (
          (err as Error)?.message?.includes('belongs to another user') ||
          (err as Error)?.message?.includes('not found')
        ) {
          return next(new NotFoundError('Scan not found.'));
        }
        next(err);
      }
    },
  );

  /**
   * POST /scans/:id/cancel
   * Cancels eligible scan.
   */
  router.post(
    '/:id/cancel',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const scanId = req.params.id as string;
        const userId = await getUserId(req);

        const cancelResult = await scanService.cancelScan(scanId, userId);

        res.status(200).json({
          success: true,
          data: cancelResult,
        });
      } catch (err) {
        if (
          (err as Error)?.message?.includes('belongs to another user') ||
          (err as Error)?.message?.includes('not found')
        ) {
          return next(new NotFoundError('Scan not found.'));
        }
        next(err);
      }
    },
  );

  return router;
}

export const defaultScanRouter = createScanRouter();
