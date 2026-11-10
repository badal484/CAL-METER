import admin from 'firebase-admin';
import { getConfig, type ApiConfig } from '../config/env.js';
import {
  AppError,
  UnauthorizedError,
  DependencyUnavailableError,
  InternalServerError,
} from './errors.js';

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

export function initializeFirebaseAdmin(config: ApiConfig = getConfig()): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (admin.apps.length > 0 && admin.apps[0]) {
    firebaseApp = admin.apps[0];
    return firebaseApp;
  }

  if (config.FIREBASE_CREDENTIAL_MODE === 'service-account') {
    if (!config.FIREBASE_CLIENT_EMAIL || !config.FIREBASE_PRIVATE_KEY) {
      throw new Error(
        '[Firebase Configuration Error] In service-account mode, both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must be provided.',
      );
    }
    const formattedKey = config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.FIREBASE_PROJECT_ID,
        clientEmail: config.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
    });
  } else {
    // Explicit application-default credentials mode
    firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: config.FIREBASE_PROJECT_ID,
    });
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
      if (!decoded.uid) {
        throw new UnauthorizedError('Authentication token does not contain a valid user identity.');
      }
      return {
        uid: decoded.uid,
        email: decoded.email,
        emailVerified: decoded.email_verified,
        name: decoded.name,
      };
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err;
      }

      const error = err as { code?: string; message?: string };
      const code = (error.code || '').toLowerCase();
      const message = (error.message || '').toLowerCase();

      // 503 DEPENDENCY_UNAVAILABLE: Certificate fetch failures, network timeouts, infrastructure outages
      if (
        code === 'auth/certificate-fetch-failed' ||
        code === 'auth/network-request-failed' ||
        code === 'auth/service-unavailable' ||
        code === 'auth/internal-error' ||
        code.includes('timeout') ||
        code.includes('network') ||
        code.includes('unavailable') ||
        code.includes('certificate') ||
        message.includes('certificate') ||
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('econnreset') ||
        message.includes('etimedout') ||
        message.includes('enotfound')
      ) {
        throw new DependencyUnavailableError('Authentication service temporarily unavailable.');
      }

      // 401 AUTH_UNAUTHORIZED: Token expiration
      if (code === 'auth/id-token-expired' || message.includes('expired')) {
        throw new UnauthorizedError('Authentication token has expired.');
      }

      // 401 AUTH_UNAUTHORIZED: Token revocation
      if (code === 'auth/id-token-revoked' || message.includes('revoked')) {
        throw new UnauthorizedError('Authentication token has been revoked.');
      }

      // 401 AUTH_UNAUTHORIZED: Disabled user account
      if (code === 'auth/user-disabled' || message.includes('disabled')) {
        throw new UnauthorizedError('The user account has been disabled.');
      }

      // 401 AUTH_UNAUTHORIZED: Invalid signature, claims, or token format
      if (
        code === 'auth/invalid-id-token' ||
        code === 'auth/argument-error' ||
        code === 'auth/decoding-error' ||
        code === 'auth/invalid-argument' ||
        code.includes('signature') ||
        message.includes('signature') ||
        message.includes('invalid') ||
        message.includes('malformed') ||
        message.includes('claim')
      ) {
        throw new UnauthorizedError('Authentication token is invalid or malformed.');
      }

      // Safe fallback: Unknown errors must NOT automatically become 401. Classify safely as an internal server error.
      throw new InternalServerError('An unexpected error occurred during authentication.');
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
