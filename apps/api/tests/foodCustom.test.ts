import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import type { IFirebaseTokenVerifier, DecodedToken } from '../src/lib/firebase.js';
import { UnauthorizedError } from '../src/lib/errors.js';

class MockTokenVerifier implements IFirebaseTokenVerifier {
  private users = new Map<string, DecodedToken>();

  registerUser(token: string, claims: DecodedToken) {
    this.users.set(token, claims);
  }

  async verifyIdToken(token: string): Promise<DecodedToken> {
    const claims = this.users.get(token);
    if (!claims) {
      throw new UnauthorizedError('Invalid test auth token.');
    }
    return claims;
  }
}

describe('Custom Food API & Multi-Tenant Ownership Safeguards', () => {
  let prisma: PrismaClient;
  let app: ReturnType<typeof createApp>;
  let verifier: MockTokenVerifier;

  const userAClaims: DecodedToken = {
    uid: `user-a-${randomUUID()}`,
    email: 'user.a@calmeter.app',
    emailVerified: true,
    name: 'User Alpha',
  };

  const userBClaims: DecodedToken = {
    uid: `user-b-${randomUUID()}`,
    email: 'user.b@calmeter.app',
    emailVerified: true,
    name: 'User Beta',
  };

  const tokenUserA = 'token-user-a';
  const tokenUserB = 'token-user-b';

  beforeAll(async () => {
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
    const nodeEnv = process.env.NODE_ENV || 'test';
    const validatedDb = validateTestDatabaseUrl(testDbUrl, nodeEnv);

    prisma = new PrismaClient({
      datasourceUrl: validatedDb.url,
    });

    verifier = new MockTokenVerifier();
    verifier.registerUser(tokenUserA, userAClaims);
    verifier.registerUser(tokenUserB, userBClaims);

    app = createApp({ prisma, verifier });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  let createdFoodId: string;

  it('rejects custom food creation when unauthorized', async () => {
    const payload = {
      name: 'Unauthenticated Protein Bowl',
      calories: 300,
      protein: 20,
      carbs: 30,
      fat: 10,
    };

    const res = await request(app).post('/api/v1/foods').send(payload);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('allows authenticated User A to create a private custom food', async () => {
    const customPayload = {
      name: "Alpha's Special Protein Khichdi",
      localNames: ['Special Khichdi'],
      cuisine: 'INDIAN_NORTH',
      servingSize: 200,
      servingUnit: 'bowl',
      calories: 260,
      protein: 16.5,
      carbs: 32.0,
      fat: 6.5,
      fiber: 5.0,
      saturatedFat: 2.1,
      sodium: 310,
      servingConversions: [
        {
          unit: 'bowl',
          gramWeight: 200,
          notes: 'Standard soup bowl',
          isDefault: true,
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/foods')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send(customPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Alpha's Special Protein Khichdi");
    expect(res.body.data.isCustom).toBe(true);
    expect(res.body.data.isVerified).toBe(false);
    expect(res.body.data.nutrientProfile.protein).toBe(16.5);
    expect(res.body.data.nutrientProfile.saturatedFat).toBe(2.1);
    expect(res.body.data.servingConversions).toHaveLength(1);

    createdFoodId = res.body.data.id;
    expect(createdFoodId).toBeDefined();
  });

  it('User A can find their private custom food in search', async () => {
    const res = await request(app)
      .get('/api/v1/foods?q=Protein%20Khichdi')
      .set('Authorization', `Bearer ${tokenUserA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const item = res.body.data.find((f: { id: string }) => f.id === createdFoodId);
    expect(item).toBeDefined();
    expect(item.name).toBe("Alpha's Special Protein Khichdi");
    expect(item.isCustom).toBe(true);
  });

  it("User B CANNOT see User A's private custom food in search results (Isolation Safeguard)", async () => {
    const res = await request(app)
      .get('/api/v1/foods?q=Protein%20Khichdi')
      .set('Authorization', `Bearer ${tokenUserB}`);

    expect(res.status).toBe(200);
    const item = res.body.data.find((f: { id: string }) => f.id === createdFoodId);
    expect(item).toBeUndefined(); // User B must never see User A's custom food
  });

  it('Unauthenticated search CANNOT see private custom foods', async () => {
    const res = await request(app).get('/api/v1/foods?q=Protein%20Khichdi');
    expect(res.status).toBe(200);
    const item = res.body.data.find((f: { id: string }) => f.id === createdFoodId);
    expect(item).toBeUndefined();
  });

  it('User A can fetch full details of their custom food by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/foods/${createdFoodId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdFoodId);
    expect(res.body.data.nutrientProfile.calories).toBe(260);
    expect(res.body.data.nutrientProfile.sodium).toBe(310);
  });

  it("User B receives 404 RESOURCE_NOT_FOUND when requesting User A's custom food by ID (Anti-Enumeration)", async () => {
    const res = await request(app)
      .get(`/api/v1/foods/${createdFoodId}`)
      .set('Authorization', `Bearer ${tokenUserB}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('Unauthenticated request receives 404 RESOURCE_NOT_FOUND for private custom food ID', async () => {
    const res = await request(app).get(`/api/v1/foods/${createdFoodId}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("User B receives 403 FORBIDDEN when attempting to update User A's custom food", async () => {
    const res = await request(app)
      .patch(`/api/v1/foods/${createdFoodId}`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({ name: 'Hacked Title' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN_RESOURCE');
  });

  it('User A can successfully update their custom food', async () => {
    const res = await request(app)
      .patch(`/api/v1/foods/${createdFoodId}`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        name: "Alpha's Super High-Protein Khichdi",
        protein: 22.0,
        calories: 285,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Alpha's Super High-Protein Khichdi");
    expect(res.body.data.protein).toBe(22.0);
    expect(res.body.data.nutrientProfile.protein).toBe(22.0);
    expect(res.body.data.calories).toBe(285);
  });

  it("User B receives 403 FORBIDDEN when attempting to delete User A's custom food", async () => {
    const res = await request(app)
      .delete(`/api/v1/foods/${createdFoodId}`)
      .set('Authorization', `Bearer ${tokenUserB}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN_RESOURCE');
  });

  it('User A can soft-delete their custom food', async () => {
    const res = await request(app)
      .delete(`/api/v1/foods/${createdFoodId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it is now archived and no longer found by User A
    const fetchAfterDelete = await request(app)
      .get(`/api/v1/foods/${createdFoodId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    expect(fetchAfterDelete.status).toBe(404);
  });
});
