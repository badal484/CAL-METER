import admin from 'firebase-admin';
import { getConfig } from '../config/env.js';
import { UnauthorizedError, DependencyUnavailableError } from './errors.js';

export interface DecodedToken {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  [key: string]: unknown;
}

export interface IFirebaseTokenVerifier {
  verifyIdToken(token: string): Promise<DecodedToken>;
}

let firebaseApp: admin.app.App | null = null;

export function initializeFirebaseAdmin(): admin.app.App {
  if (!firebaseApp) {
    if (admin.apps.length > 0 && admin.apps[0]) {
      firebaseApp = admin.apps[0];
      return firebaseApp;
    }

    const config = getConfig();

    if (config.FIREBASE_CLIENT_EMAIL && config.FIREBASE_PRIVATE_KEY) {
      // Production service account initialization
      const formattedKey = config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.FIREBASE_PROJECT_ID,
          clientEmail: config.FIREBASE_CLIENT_EMAIL,
          privateKey: formattedKey,
        }),
      });
    } else {
      // Local development or application default credentials
      firebaseApp = admin.initializeApp({
        projectId: config.FIREBASE_PROJECT_ID,
      });
    }
  }
  return firebaseApp;
}

export class FirebaseAdminTokenVerifier implements IFirebaseTokenVerifier {
  private app: admin.app.App;

  constructor(app?: admin.app.App) {
    this.app = app || initializeFirebaseAdmin();
  }

  async verifyIdToken(token: string): Promise<DecodedToken> {
    try {
      const decoded = await this.app.auth().verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email,
        emailVerified: decoded.email_verified,
        name: decoded.name,
      };
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      const code = error.code || '';

      // Expired or invalid user credentials
      if (
        code === 'auth/id-token-expired' ||
        code === 'auth/id-token-revoked' ||
        code === 'auth/argument-error' ||
        code === 'auth/invalid-id-token' ||
        code === 'auth/user-disabled'
      ) {
        throw new UnauthorizedError('Authentication token is invalid or expired.');
      }

      // Infrastructure or network service outages
      if (
        code.includes('network') ||
        code.includes('timeout') ||
        code === 'auth/internal-error' ||
        (error.message && error.message.includes('ECONNREFUSED'))
      ) {
        throw new DependencyUnavailableError('Authentication service temporarily unavailable.');
      }

      // Default safe unauthorized error for unrecognized token issues
      throw new UnauthorizedError('Authentication failed.');
    }
  }
}

let defaultVerifier: IFirebaseTokenVerifier | null = null;

export function getFirebaseTokenVerifier(): IFirebaseTokenVerifier {
  if (!defaultVerifier) {
    defaultVerifier = new FirebaseAdminTokenVerifier();
  }
  return defaultVerifier;
}

export function setFirebaseTokenVerifierForTesting(verifier: IFirebaseTokenVerifier | null): void {
  defaultVerifier = verifier;
}
