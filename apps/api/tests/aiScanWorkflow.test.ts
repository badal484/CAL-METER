import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import { seedFoodDatabase } from '../src/services/foodSeed.service.js';
import { setVisionProvider } from '../src/ai/factory.js';
import { MockFoodVisionProvider } from '../src/ai/providers/mockVision.provider.js';
import type { IFirebaseTokenVerifier, FirebaseDecodedToken } from '../src/lib/firebase.js';

// Helper to construct a valid JPEG image buffer
function createValidTestJpeg(): Buffer {
  const parts: Buffer[] = [
    Buffer.from([0xff, 0xd8]), // SOI
    Buffer.from([
      0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00,
      0x01, 0x00, 0x00,
    ]), // APP0 JFIF
    Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0xc8, 0x00, 0xc8, 0x01, 0x01, 0x11, 0x00]), // SOF0 (200x200)
    Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]), // SOS
    Buffer.alloc(100, 0x77), // dummy compressed bytes
    Buffer.from([0xff, 0xd9]), // EOI
  ];
  return Buffer.concat(parts);
}

class TestAuthVerifier implements IFirebaseTokenVerifier {
  private users: Map<string, FirebaseDecodedToken> = new Map();

  register(token: string, payload: FirebaseDecodedToken) {
    this.users.set(token, payload);
  }

  async verifyIdToken(token: string): Promise<FirebaseDecodedToken> {
    const user = this.users.get(token);
    if (!user) throw new Error('Invalid test token');
    return user;
  }
}

describe('AI Food Recognition & Nutrition Estimation API Workflow', () => {
  let prisma: PrismaClient;
  let verifier: TestAuthVerifier;
  let app: any;
  let mockVision: MockFoodVisionProvider;

  const TOKEN_USER_A = 'token-workflow-user-a';
  const TOKEN_USER_B = 'token-workflow-user-b';

  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
    validateTestDatabaseUrl(testDbUrl);

    prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await prisma.$connect();

    // Seed reference food catalog
    await seedFoodDatabase(prisma);

    // Wire auth verifier
    verifier = new TestAuthVerifier();
    verifier.register(TOKEN_USER_A, {
      uid: 'firebase-uid-workflow-a',
      email: 'user.workflow.a@calmeter.app',
      emailVerified: true,
      name: 'Workflow User A',
    });
    verifier.register(TOKEN_USER_B, {
      uid: 'firebase-uid-workflow-b',
      email: 'user.workflow.b@calmeter.app',
      emailVerified: true,
      name: 'Workflow User B',
    });

    // Wire mock AI vision provider
    mockVision = new MockFoodVisionProvider('multi');
    setVisionProvider(mockVision);

    app = createApp({ verifier, prisma });

    // Pre-create users in DB
    const uA = await prisma.user.upsert({
      where: { email: 'user.workflow.a@calmeter.app' },
      update: {},
      create: {
        firebaseUid: 'firebase-uid-workflow-a',
        email: 'user.workflow.a@calmeter.app',
        name: 'Workflow User A',
      },
    });
    userAId = uA.id;

    const uB = await prisma.user.upsert({
      where: { email: 'user.workflow.b@calmeter.app' },
      update: {},
      create: {
        firebaseUid: 'firebase-uid-workflow-b',
        email: 'user.workflow.b@calmeter.app',
        name: 'Workflow User B',
      },
    });
    userBId = uB.id;

    // Clean previous scan logs for clean quota testing
    await prisma.mealFoodItem.deleteMany({
      where: { mealEntry: { userId: { in: [userAId, userBId] } } },
    });
    await prisma.mealEntry.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.foodScanLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  });

  afterAll(async () => {
    await prisma.mealFoodItem.deleteMany({
      where: { mealEntry: { userId: { in: [userAId, userBId] } } },
    });
    await prisma.mealEntry.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.foodScanLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({
      where: { email: { in: ['user.workflow.a@calmeter.app', 'user.workflow.b@calmeter.app'] } },
    });
    await prisma.$disconnect();
  });

  it('1. POST /api/v1/scans: creates a scan session with secure upload URL', async () => {
    const res = await request(app)
      .post('/api/v1/scans')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({
        mimeType: 'image/jpeg',
        fileSizeBytes: 204800,
        mealType: 'LUNCH',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scanId).toBeDefined();
    expect(res.body.data.status).toBe('CREATED');
    expect(res.body.data.storageKey).toContain(userAId);
    expect(res.body.data.uploadUrl).toBeDefined();
  });

  it('2. POST /api/v1/scans: rejects unauthorized requests without token', async () => {
    const res = await request(app).post('/api/v1/scans').send({ mimeType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });

  it('3. POST /api/v1/scans: rejects unsupported image mime types', async () => {
    const res = await request(app)
      .post('/api/v1/scans')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({ mimeType: 'image/gif' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('4. POST /api/v1/scans: enforces daily scan quota (max 3 scans per day on free tier)', async () => {
    // User A already created 1 scan in test 1.
    // Create 2 more scans to reach quota limit (3 total)
    const scan2 = await request(app)
      .post('/api/v1/scans')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({ mimeType: 'image/jpeg' });
    expect(scan2.status).toBe(201);

    const scan3 = await request(app)
      .post('/api/v1/scans')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({ mimeType: 'image/jpeg' });
    expect(scan3.status).toBe(201);

    // 4th scan attempt must be blocked with HTTP 429 DAILY_SCAN_LIMIT_REACHED
    const scan4 = await request(app)
      .post('/api/v1/scans')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({ mimeType: 'image/jpeg' });

    expect(scan4.status).toBe(429);
    expect(scan4.body.error.code).toBe('DAILY_SCAN_LIMIT_REACHED');
  });

  it('5. Full End-to-End Pipeline: Upload -> Process -> Review -> Correct -> Confirm', async () => {
    // Use User B for the complete pipeline walkthrough
    // Step A: Create scan session
    const createRes = await request(app)
      .post('/api/v1/scans')
      .set('Authorization', `Bearer ${TOKEN_USER_B}`)
      .send({ mimeType: 'image/jpeg', mealType: 'DINNER' });

    expect(createRes.status).toBe(201);
    const scanId = createRes.body.data.scanId;

    // Step B: Upload valid binary image
    const validJpeg = createValidTestJpeg();
    const uploadRes = await request(app)
      .post(`/api/v1/scans/${scanId}/upload`)
      .set('Authorization', `Bearer ${TOKEN_USER_B}`)
      .set('Content-Type', 'image/jpeg')
      .send(validJpeg);

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.data.status).toBe('UPLOADED');
    expect(uploadRes.body.data.imageWidth).toBe(200);
    expect(uploadRes.body.data.imageHeight).toBe(200);

    // Step C: Trigger AI recognition processing
    mockVision.setScenario('multi'); // returns Roti (2 pcs, 70g) + Dal Tadka (1 katori, 200g)
    const processRes = await request(app)
      .post(`/api/v1/scans/${scanId}/process`)
      .set('Authorization', `Bearer ${TOKEN_USER_B}`);

    expect(processRes.status).toBe(202);
    expect(processRes.body.data.scan.status).toBe('NEEDS_REVIEW');

    const detected = processRes.body.data.scan.detectedItems;
    expect(detected.length).toBe(2);

    // Step D: GET /api/v1/scans/:id retrieves full details with backend calculated nutrition
    const getRes = await request(app)
      .get(`/api/v1/scans/${scanId}`)
      .set('Authorization', `Bearer ${TOKEN_USER_B}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe('NEEDS_REVIEW');
    expect(getRes.body.data.nutritionResult.calories).toBeGreaterThan(300);
    expect(getRes.body.data.nutritionResult.protein).toBeGreaterThan(12);

    // Step E: Multi-tenant protection: User A CANNOT view User B's scan
    const forbiddenGet = await request(app)
      .get(`/api/v1/scans/${scanId}`)
      .set('Authorization', `Bearer ${TOKEN_USER_A}`);

    expect(forbiddenGet.status).toBe(404);

    // Step F: User B submits corrections: adjusts portion of Dal from 1 katori to 1.5 katori
    const dalCandidate = detected.find((c: any) => c.name.includes('Dal'))!;
    const correctionsRes = await request(app)
      .patch(`/api/v1/scans/${scanId}/corrections`)
      .set('Authorization', `Bearer ${TOKEN_USER_B}`)
      .send({
        items: [
          {
            candidateId: dalCandidate.id,
            action: 'UPDATE',
            portion: {
              quantity: 1.5,
              unit: 'katori',
              gramWeight: 300,
            },
          },
        ],
      });

    expect(correctionsRes.status).toBe(200);
    expect(correctionsRes.body.data.userEdited).toBe(true);
    expect(correctionsRes.body.data.status).toBe('NEEDS_REVIEW');

    // Step G: User confirms the meal -> creates entry in food diary
    const confirmRes = await request(app)
      .post(`/api/v1/scans/${scanId}/confirm`)
      .set('Authorization', `Bearer ${TOKEN_USER_B}`)
      .send({
        mealType: 'DINNER',
        notes: 'Delicious homestyle dinner scan',
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('COMPLETED');
    expect(confirmRes.body.data.mealEntryId).toBeDefined();
    expect(confirmRes.body.data.itemCount).toBe(2);

    // Verify MealEntry exists in database
    const mealInDb = await prisma.mealEntry.findUnique({
      where: { id: confirmRes.body.data.mealEntryId },
      include: { items: true },
    });

    expect(mealInDb).not.toBeNull();
    expect(mealInDb?.items.length).toBe(2);
    expect(mealInDb?.items[0]?.loggedMethod).toBe('AI_PHOTO');

    // Step H: Idempotency test: calling confirm a second time returns existing meal without duplicate items
    const secondConfirmRes = await request(app)
      .post(`/api/v1/scans/${scanId}/confirm`)
      .set('Authorization', `Bearer ${TOKEN_USER_B}`)
      .send();

    expect(secondConfirmRes.status).toBe(200);
    expect(secondConfirmRes.body.data.mealEntryId).toBe(confirmRes.body.data.mealEntryId);

    // Assert that items in DB were NOT duplicated
    const countItems = await prisma.mealFoodItem.count({
      where: { mealEntryId: confirmRes.body.data.mealEntryId },
    });
    expect(countItems).toBe(2);

    // Step I: Cannot cancel an already completed scan
    const cancelCompletedRes = await request(app)
      .post(`/api/v1/scans/${scanId}/cancel`)
      .set('Authorization', `Bearer ${TOKEN_USER_B}`);

    expect(cancelCompletedRes.status).toBe(400);
  });

  it('6. Allows cancellation of an eligible scan session', async () => {
    // Reset User A's scans so quota allows a new scan
    await prisma.foodScanLog.deleteMany({ where: { userId: userAId } });

    const createRes = await request(app)
      .post('/api/v1/scans')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({ mimeType: 'image/jpeg' });

    expect(createRes.status).toBe(201);
    const scanId = createRes.body.data.scanId;

    const cancelRes = await request(app)
      .post(`/api/v1/scans/${scanId}/cancel`)
      .set('Authorization', `Bearer ${TOKEN_USER_A}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    // Verify DB status
    const scanInDb = await prisma.foodScanLog.findUnique({ where: { id: scanId } });
    expect(scanInDb?.status).toBe('CANCELLED');
    expect(scanInDb?.cancelledAt).not.toBeNull();
  });
});
