import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AdminRole, hasRequiredAdminRole } from '@calmeter/shared';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import { getFirebaseTokenVerifier, type IFirebaseTokenVerifier } from '../lib/firebase.js';

export interface AuthenticatedAdmin {
  id: string;
  firebaseUid: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AuthenticatedAdmin;
    }
  }
}

export function createAdminAuthMiddleware(
  prisma: PrismaClient,
  customVerifier?: IFirebaseTokenVerifier,
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new UnauthorizedError('Missing administrator authorization header.');
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
        throw new UnauthorizedError('Malformed Authorization header. Format: Bearer <token>');
      }

      const token = parts[1];
      const verifier = customVerifier || getFirebaseTokenVerifier();
      const decoded = await verifier.verifyIdToken(token);

      if (!decoded.uid) {
        throw new UnauthorizedError('Token does not contain a valid identity.');
      }

      // Check admin_users table for administrator role
      const admin = await prisma.adminUser.findUnique({
        where: { firebaseUid: decoded.uid },
      });

      if (!admin) {
        throw new ForbiddenError(
          'Access denied: user is not an authorized CAL METER administrator.',
        );
      }

      if (!admin.isActive) {
        throw new ForbiddenError('Access denied: administrator account is currently suspended.');
      }

      req.admin = {
        id: admin.id,
        firebaseUid: admin.firebaseUid,
        email: admin.email,
        name: admin.name,
        role: admin.role as AdminRole,
        isActive: admin.isActive,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Route-level RBAC guard enforcing the minimum required role.
 */
export function requireAdminRole(minimumRole: AdminRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin) {
      return next(new UnauthorizedError('Administrator authentication required.'));
    }

    if (!hasRequiredAdminRole(req.admin.role, minimumRole)) {
      return next(
        new ForbiddenError(
          `Insufficient administrative privileges. Minimum required role: ${minimumRole} (Current: ${req.admin.role})`,
        ),
      );
    }

    return next();
  };
}
