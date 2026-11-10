import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { getFirebaseTokenVerifier, type IFirebaseTokenVerifier } from '../lib/firebase.js';

export function createAuthMiddleware(
  customVerifier?: IFirebaseTokenVerifier,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new UnauthorizedError('Missing Authorization header.');
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
        throw new UnauthorizedError('Malformed Authorization header. Format: Bearer <token>');
      }

      const token = parts[1];
      const verifier = customVerifier || getFirebaseTokenVerifier();
      const decoded = await verifier.verifyIdToken(token);

      if (!decoded.uid) {
        throw new UnauthorizedError('Token does not contain a valid user identity.');
      }

      // Attach verified principal. Never trust client-supplied identity.
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        emailVerified: decoded.emailVerified,
        name: decoded.name,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

export const authenticate = createAuthMiddleware();
