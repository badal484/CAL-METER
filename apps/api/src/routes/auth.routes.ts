import { Router, type Request, type Response } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import type { IFirebaseTokenVerifier } from '../lib/firebase.js';

export function createAuthRouter(verifier?: IFirebaseTokenVerifier): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(verifier);

  router.get('/test', authMiddleware, (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        message: 'Authenticated test route accessed successfully.',
        principal: req.user,
      },
    });
  });

  return router;
}

export const authRouter = createAuthRouter();
