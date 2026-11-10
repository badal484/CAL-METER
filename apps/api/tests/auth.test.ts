import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type admin from 'firebase-admin';
import { createApp } from '../src/app.js';
import {
  FirebaseAdminTokenVerifier,
  type IFirebaseTokenVerifier,
  type DecodedToken,
} from '../src/lib/firebase.js';
import {
  UnauthorizedError,
  DependencyUnavailableError,
  InternalServerError,
} from '../src/lib/errors.js';
import { validateEnv } from '../src/config/env.js';

class MockTokenVerifier implements IFirebaseTokenVerifier {
  constructor(
    private behavior: 'valid' | 'invalid' | 'expired' | 'infra_failure' = 'valid',
    private claims: DecodedToken = {
      uid: 'firebase-user-verified-12345',
      email: 'verified@calmeter.app',
      emailVerified: true,
      name: 'Verified User',
    },
  ) {}

  async verifyIdToken(token: string): Promise<DecodedToken> {
    if (this.behavior === 'invalid') {
      throw new UnauthorizedError('Authentication token is invalid.');
    }
    if (this.behavior === 'expired') {
      throw new UnauthorizedError('Authentication token is expired.');
    }
    if (this.behavior === 'infra_failure') {
      throw new DependencyUnavailableError('Authentication service temporarily unavailable.');
    }
    if (token === 'valid-test-token') {
      return this.claims;
    }
    throw new UnauthorizedError('Unknown token');
  }
}

describe('Firebase Authentication Middleware & Verification Boundary', () => {
  it('returns 401 AUTH_UNAUTHORIZED when Authorization header is missing', async () => {
    const app = createApp({ verifier: new MockTokenVerifier('valid') });
    const res = await request(app).get('/api/v1/auth/test');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'AUTH_UNAUTHORIZED',
        message: 'Missing Authorization header.',
      },
    });
  });

  it('returns 401 AUTH_UNAUTHORIZED for malformed Bearer header formats', async () => {
    const app = createApp({ verifier: new MockTokenVerifier('valid') });

    const malformedHeaders = [
      'Basic dXNlcjpwYXNz',
      'Bearer',
      'Bearer token1 token2',
      'TokenOnlyXYZ',
    ];

    for (const header of malformedHeaders) {
      const res = await request(app).get('/api/v1/auth/test').set('Authorization', header);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
    }
  });

  it('returns 401 AUTH_UNAUTHORIZED when the token is invalid', async () => {
    const app = createApp({ verifier: new MockTokenVerifier('invalid') });
    const res = await request(app)
      .get('/api/v1/auth/test')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('returns 401 AUTH_UNAUTHORIZED when the token has expired', async () => {
    const app = createApp({ verifier: new MockTokenVerifier('expired') });
    const res = await request(app)
      .get('/api/v1/auth/test')
      .set('Authorization', 'Bearer expired-token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('authenticates valid token, attaching verified principal to the request context', async () => {
    const verifiedClaims = {
      uid: 'firebase-user-real-999',
      email: 'john@example.com',
      emailVerified: true,
      name: 'John Doe',
    };
    const app = createApp({
      verifier: new MockTokenVerifier('valid', verifiedClaims),
    });

    const res = await request(app)
      .get('/api/v1/auth/test')
      .set('Authorization', 'Bearer valid-test-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('Authenticated test route accessed successfully.');
    expect(res.body.data.principal).toEqual({
      uid: 'firebase-user-real-999',
      email: 'john@example.com',
      emailVerified: true,
      name: 'John Doe',
    });
  });

  it('enforces that verified token UID is used, ignoring any client-supplied spoofed UID', async () => {
    const verifiedClaims = {
      uid: 'verified-authentic-user-123',
      email: 'authentic@example.com',
    };
    const app = createApp({
      verifier: new MockTokenVerifier('valid', verifiedClaims),
    });

    // Client attempts to spoof a victim's user ID via headers, query, or body
    const res = await request(app)
      .get('/api/v1/auth/test?userId=victim-user-456&uid=victim-user-456')
      .set('Authorization', 'Bearer valid-test-token')
      .set('x-user-id', 'victim-user-456');

    expect(res.status).toBe(200);
    expect(res.body.data.principal.uid).toBe('verified-authentic-user-123');
    expect(res.body.data.principal.uid).not.toBe('victim-user-456');
  });

  it('distinguishes Firebase infrastructure failure from invalid user credentials, returning 503', async () => {
    const app = createApp({
      verifier: new MockTokenVerifier('infra_failure'),
    });

    const res = await request(app)
      .get('/api/v1/auth/test')
      .set('Authorization', 'Bearer valid-test-token');

    // Infrastructure outage must NOT return 401 AUTH_UNAUTHORIZED
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(res.body.error.message).toBe('Authentication service temporarily unavailable.');
  });
});

describe('FirebaseAdminTokenVerifier Error Classification & Mapping', () => {
  function createVerifierWithMockError(errorToThrow: unknown): FirebaseAdminTokenVerifier {
    const mockApp = {
      auth: () => ({
        verifyIdToken: async () => {
          throw errorToThrow;
        },
      }),
    } as unknown as admin.app.App;
    return new FirebaseAdminTokenVerifier(mockApp);
  }

  it('maps certificate-fetch failure to 503 DEPENDENCY_UNAVAILABLE', async () => {
    const verifier = createVerifierWithMockError({
      code: 'auth/certificate-fetch-failed',
      message: 'Failed to retrieve public keys from Google certificate endpoint.',
    });

    await expect(verifier.verifyIdToken('some-token')).rejects.toThrow(DependencyUnavailableError);
    await expect(verifier.verifyIdToken('some-token')).rejects.toMatchObject({
      statusCode: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('maps network failures and socket reset to 503 DEPENDENCY_UNAVAILABLE', async () => {
    const verifier = createVerifierWithMockError({
      code: 'auth/network-request-failed',
      message: 'Network request to Firebase auth service failed with ECONNRESET',
    });

    await expect(verifier.verifyIdToken('some-token')).rejects.toThrow(DependencyUnavailableError);
    await expect(verifier.verifyIdToken('some-token')).rejects.toMatchObject({
      statusCode: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('maps timeout failures (ETIMEDOUT) to 503 DEPENDENCY_UNAVAILABLE', async () => {
    const verifier = createVerifierWithMockError({
      code: 'auth/internal-error',
      message: 'Connection timed out while fetching keys: ETIMEDOUT',
    });

    await expect(verifier.verifyIdToken('some-token')).rejects.toThrow(DependencyUnavailableError);
    await expect(verifier.verifyIdToken('some-token')).rejects.toMatchObject({
      statusCode: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('maps invalid signature to 401 AUTH_UNAUTHORIZED', async () => {
    const verifier = createVerifierWithMockError({
      code: 'auth/invalid-id-token',
      message: 'Firebase ID token has invalid signature.',
    });

    await expect(verifier.verifyIdToken('some-token')).rejects.toThrow(UnauthorizedError);
    await expect(verifier.verifyIdToken('some-token')).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_UNAUTHORIZED',
    });
  });

  it('maps expired tokens to 401 AUTH_UNAUTHORIZED', async () => {
    const verifier = createVerifierWithMockError({
      code: 'auth/id-token-expired',
      message: 'Firebase ID token has expired. Get a fresh ID token and try again.',
    });

    await expect(verifier.verifyIdToken('some-token')).rejects.toThrow(UnauthorizedError);
    await expect(verifier.verifyIdToken('some-token')).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_UNAUTHORIZED',
    });
  });

  it('maps revoked tokens to 401 AUTH_UNAUTHORIZED', async () => {
    const verifier = createVerifierWithMockError({
      code: 'auth/id-token-revoked',
      message: 'Firebase ID token has been revoked.',
    });

    await expect(verifier.verifyIdToken('some-token')).rejects.toThrow(UnauthorizedError);
    await expect(verifier.verifyIdToken('some-token')).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_UNAUTHORIZED',
    });
  });

  it('maps disabled user account to 401 AUTH_UNAUTHORIZED', async () => {
    const verifier = createVerifierWithMockError({
      code: 'auth/user-disabled',
      message: 'The user account has been disabled by an administrator.',
    });

    await expect(verifier.verifyIdToken('some-token')).rejects.toThrow(UnauthorizedError);
    await expect(verifier.verifyIdToken('some-token')).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_UNAUTHORIZED',
    });
  });

  it('maps unknown SDK errors to 500 INTERNAL_SERVER_ERROR without exposing internal details', async () => {
    const verifier = createVerifierWithMockError({
      code: 'auth/unknown-unexpected-condition',
      message: 'Internal unhandled Firebase runtime state',
    });

    // Unknown errors MUST NOT automatically become 401 AUTH_UNAUTHORIZED
    await expect(verifier.verifyIdToken('some-token')).rejects.toThrow(InternalServerError);
    await expect(verifier.verifyIdToken('some-token')).rejects.toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred during authentication.',
    });
  });
});

describe('Firebase Credential Mode Configuration Validation', () => {
  const baseValidEnv = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_dev',
    REDIS_URL: 'redis://localhost:6379',
    FIREBASE_PROJECT_ID: 'calmeter-test-project',
  };

  it('rejects incomplete service-account configuration (missing client email or private key)', () => {
    expect(() =>
      validateEnv({
        ...baseValidEnv,
        FIREBASE_CREDENTIAL_MODE: 'service-account',
        FIREBASE_CLIENT_EMAIL: '',
        FIREBASE_PRIVATE_KEY: '',
      }),
    ).toThrow(/FIREBASE_CLIENT_EMAIL is required.*FIREBASE_PRIVATE_KEY is required/s);
  });

  it('accepts valid service-account configuration when both email and key are provided', () => {
    const config = validateEnv({
      ...baseValidEnv,
      FIREBASE_CREDENTIAL_MODE: 'service-account',
      FIREBASE_CLIENT_EMAIL: 'sa@calmeter-test-project.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY:
        '-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgk...\\n-----END PRIVATE KEY-----\\n',
    });

    expect(config.FIREBASE_CREDENTIAL_MODE).toBe('service-account');
    expect(config.FIREBASE_CLIENT_EMAIL).toBe('sa@calmeter-test-project.iam.gserviceaccount.com');
  });

  it('accepts explicit application-default credential mode', () => {
    const config = validateEnv({
      ...baseValidEnv,
      FIREBASE_CREDENTIAL_MODE: 'application-default',
    });

    expect(config.FIREBASE_CREDENTIAL_MODE).toBe('application-default');
  });

  it('requires explicit credential mode in production environment', () => {
    expect(() =>
      validateEnv({
        ...baseValidEnv,
        NODE_ENV: 'production',
        FIREBASE_CREDENTIAL_MODE: undefined,
      }),
    ).toThrow(/FIREBASE_CREDENTIAL_MODE must be explicitly configured in production/);
  });
});

describe('Concurrent Application Verifier Isolation (No Global State)', () => {
  it('runs two Express app instances concurrently with different verifiers and zero cross-talk', async () => {
    const verifierA: IFirebaseTokenVerifier = {
      async verifyIdToken(token: string) {
        if (token === 'token-alice') {
          return { uid: 'user-alice-111', email: 'alice@example.com', name: 'Alice' };
        }
        throw new UnauthorizedError('Rejected by Verifier A');
      },
    };

    const verifierB: IFirebaseTokenVerifier = {
      async verifyIdToken(token: string) {
        if (token === 'token-bob') {
          return { uid: 'user-bob-222', email: 'bob@example.com', name: 'Bob' };
        }
        throw new UnauthorizedError('Rejected by Verifier B');
      },
    };

    const appA = createApp({ verifier: verifierA });
    const appB = createApp({ verifier: verifierB });

    // Issue concurrent requests to both applications
    const [resAWithA, resAWithB, resBWithB, resBWithA] = await Promise.all([
      request(appA).get('/api/v1/auth/test').set('Authorization', 'Bearer token-alice'),
      request(appA).get('/api/v1/auth/test').set('Authorization', 'Bearer token-bob'),
      request(appB).get('/api/v1/auth/test').set('Authorization', 'Bearer token-bob'),
      request(appB).get('/api/v1/auth/test').set('Authorization', 'Bearer token-alice'),
    ]);

    // App A only verifies Alice
    expect(resAWithA.status).toBe(200);
    expect(resAWithA.body.data.principal.uid).toBe('user-alice-111');
    expect(resAWithB.status).toBe(401);
    expect(resAWithB.body.error.message).toBe('Rejected by Verifier A');

    // App B only verifies Bob
    expect(resBWithB.status).toBe(200);
    expect(resBWithB.body.data.principal.uid).toBe('user-bob-222');
    expect(resBWithA.status).toBe(401);
    expect(resBWithA.body.error.message).toBe('Rejected by Verifier B');
  });
});
