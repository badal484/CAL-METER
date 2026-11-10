import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { IFirebaseTokenVerifier, DecodedToken } from '../src/lib/firebase.js';
import { UnauthorizedError, DependencyUnavailableError } from '../src/lib/errors.js';

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
    const app = createApp({ customVerifier: new MockTokenVerifier('valid') });
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
    const app = createApp({ customVerifier: new MockTokenVerifier('valid') });

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
    const app = createApp({ customVerifier: new MockTokenVerifier('invalid') });
    const res = await request(app)
      .get('/api/v1/auth/test')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('returns 401 AUTH_UNAUTHORIZED when the token has expired', async () => {
    const app = createApp({ customVerifier: new MockTokenVerifier('expired') });
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
      customVerifier: new MockTokenVerifier('valid', verifiedClaims),
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
      customVerifier: new MockTokenVerifier('valid', verifiedClaims),
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
      customVerifier: new MockTokenVerifier('infra_failure'),
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
