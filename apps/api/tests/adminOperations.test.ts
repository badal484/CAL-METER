import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import type { IFirebaseTokenVerifier, FirebaseDecodedToken } from '../src/lib/firebase.js';
import { AdminRole, SupportTicketCategory, SupportTicketPriority } from '@calmeter/shared';

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

describe('Web Admin Panel & Operations Dashboard Backend (Part 14)', () => {
  let prisma: PrismaClient;
  let verifier: TestAuthVerifier;
  let app: any;

  const TOKEN_SUPER_ADMIN = 'token-super-admin';
  const TOKEN_OPS_ADMIN = 'token-ops-admin';
  const TOKEN_SUPPORT_ADMIN = 'token-support-admin';
  const TOKEN_NUTRITION_EDITOR = 'token-nutrition-editor';
  const TOKEN_SUSPENDED_ADMIN = 'token-suspended-admin';
  const TOKEN_REGULAR_USER = 'token-regular-user';

  let superAdminId: string;
  let opsAdminId: string;
  let _supportAdminId: string;
  let nutritionEditorId: string;
  let testTargetUserId: string;

  beforeAll(async () => {
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
    validateTestDatabaseUrl(testDbUrl);

    prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await prisma.$connect();

    verifier = new TestAuthVerifier();

    const registerToken = (token: string, uid: string, email: string) => {
      verifier.register(token, {
        uid,
        email,
        email_verified: true,
        auth_time: Math.floor(Date.now() / 1000),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
    };

    registerToken(TOKEN_SUPER_ADMIN, 'fb-super-admin', 'superadmin@calmeter.test');
    registerToken(TOKEN_OPS_ADMIN, 'fb-ops-admin', 'opsadmin@calmeter.test');
    registerToken(TOKEN_SUPPORT_ADMIN, 'fb-support-admin', 'supportadmin@calmeter.test');
    registerToken(TOKEN_NUTRITION_EDITOR, 'fb-nutrition-editor', 'editor@calmeter.test');
    registerToken(TOKEN_SUSPENDED_ADMIN, 'fb-suspended-admin', 'suspended@calmeter.test');
    registerToken(TOKEN_REGULAR_USER, 'fb-reg-user', 'regular@calmeter.test');

    // Create target user for operations
    const regularUser = await prisma.user.upsert({
      where: { firebaseUid: 'fb-reg-user' },
      update: {},
      create: {
        firebaseUid: 'fb-reg-user',
        email: 'regular@calmeter.test',
        name: 'Regular Test User',
      },
    });
    testTargetUserId = regularUser.id;

    // Seed Admin Users
    const superAdmin = await prisma.adminUser.upsert({
      where: { firebaseUid: 'fb-super-admin' },
      update: { role: AdminRole.SUPER_ADMIN, isActive: true },
      create: {
        firebaseUid: 'fb-super-admin',
        email: 'superadmin@calmeter.test',
        name: 'Chief Super Admin',
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    superAdminId = superAdmin.id;

    const opsAdmin = await prisma.adminUser.upsert({
      where: { firebaseUid: 'fb-ops-admin' },
      update: { role: AdminRole.OPERATIONS_ADMIN, isActive: true },
      create: {
        firebaseUid: 'fb-ops-admin',
        email: 'opsadmin@calmeter.test',
        name: 'Ops Admin User',
        role: AdminRole.OPERATIONS_ADMIN,
        isActive: true,
      },
    });
    opsAdminId = opsAdmin.id;

    const supportAdmin = await prisma.adminUser.upsert({
      where: { firebaseUid: 'fb-support-admin' },
      update: { role: AdminRole.SUPPORT_ADMIN, isActive: true },
      create: {
        firebaseUid: 'fb-support-admin',
        email: 'supportadmin@calmeter.test',
        name: 'Support Admin User',
        role: AdminRole.SUPPORT_ADMIN,
        isActive: true,
      },
    });
    _supportAdminId = supportAdmin.id;

    const nutritionEditor = await prisma.adminUser.upsert({
      where: { firebaseUid: 'fb-nutrition-editor' },
      update: { role: AdminRole.NUTRITION_EDITOR, isActive: true },
      create: {
        firebaseUid: 'fb-nutrition-editor',
        email: 'editor@calmeter.test',
        name: 'Nutrition Editor User',
        role: AdminRole.NUTRITION_EDITOR,
        isActive: true,
      },
    });
    nutritionEditorId = nutritionEditor.id;

    await prisma.adminUser.upsert({
      where: { firebaseUid: 'fb-suspended-admin' },
      update: { role: AdminRole.SUPPORT_ADMIN, isActive: false },
      create: {
        firebaseUid: 'fb-suspended-admin',
        email: 'suspended@calmeter.test',
        name: 'Suspended Admin',
        role: AdminRole.SUPPORT_ADMIN,
        isActive: false,
      },
    });

    app = createApp({ prisma, verifier });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. Authentication & RBAC Guards
  // ---------------------------------------------------------------------------
  describe('Admin Auth & Role-Based Access Control (RBAC)', () => {
    it('rejects unauthenticated requests to admin routes with 401', async () => {
      const res = await request(app).get('/api/v1/admin/me');
      expect(res.status).toBe(401);
    });

    it('rejects regular non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/me')
        .set('Authorization', `Bearer ${TOKEN_REGULAR_USER}`);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('not an authorized CAL METER administrator');
    });

    it('rejects suspended administrators with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/me')
        .set('Authorization', `Bearer ${TOKEN_SUSPENDED_ADMIN}`);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('administrator account is currently suspended');
    });

    it('allows valid administrator and returns profile via GET /api/v1/admin/me', async () => {
      const res = await request(app)
        .get('/api/v1/admin/me')
        .set('Authorization', `Bearer ${TOKEN_SUPER_ADMIN}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe(AdminRole.SUPER_ADMIN);
      expect(res.body.data.email).toBe('superadmin@calmeter.test');
    });

    it('blocks SUPPORT_ADMIN from accessing SUPER_ADMIN only endpoint (e.g. GET /admins)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/admins')
        .set('Authorization', `Bearer ${TOKEN_SUPPORT_ADMIN}`);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Insufficient administrative privileges');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Dashboard Overview
  // ---------------------------------------------------------------------------
  describe('Dashboard Overview & Telemetry', () => {
    it('returns business, product, and operational KPIs for SUPPORT_ADMIN or higher', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/overview')
        .set('Authorization', `Bearer ${TOKEN_SUPPORT_ADMIN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.business).toHaveProperty('totalUsers');
      expect(data.business).toHaveProperty('conversionRatePercent');
      expect(data.product).toHaveProperty('dailyDiaryEntries');
      expect(data.operational).toHaveProperty('apiUptimeSeconds');
      expect(data.operational).toHaveProperty('databaseStatus', 'healthy');
      expect(Array.isArray(data.trendSeries)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. User Management & Suspension Lifecycle
  // ---------------------------------------------------------------------------
  describe('User Management', () => {
    it('lists users with pagination and search', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${TOKEN_SUPPORT_ADMIN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it('fetches complete user details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${testTargetUserId}`)
        .set('Authorization', `Bearer ${TOKEN_SUPPORT_ADMIN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testTargetUserId);
    });

    it('suspends a user with an audit reason (requires OPERATIONS_ADMIN)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${testTargetUserId}/suspend`)
        .set('Authorization', `Bearer ${TOKEN_OPS_ADMIN}`)
        .send({ reason: 'Suspicious bot activity detected on automated meal endpoints' });

      expect(res.status).toBe(200);
      expect(res.body.data.isSuspended).toBe(true);
      expect(res.body.data.suspensionReason).toContain('Suspicious bot activity');

      // Verify audit log was recorded
      const log = await prisma.adminAuditLog.findFirst({
        where: {
          action: 'USER_SUSPEND',
          targetId: testTargetUserId,
        },
      });
      expect(log).not.toBeNull();
      expect(log?.adminId).toBe(opsAdminId);
    });

    it('reactivates a suspended user with an audit trail', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${testTargetUserId}/reactivate`)
        .set('Authorization', `Bearer ${TOKEN_OPS_ADMIN}`)
        .send({ reason: 'User identity verified and restored' });

      expect(res.status).toBe(200);
      expect(res.body.data.isSuspended).toBe(false);
      expect(res.body.data.suspensionReason).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Food Database Management
  // ---------------------------------------------------------------------------
  describe('Food Database Management (NUTRITION_EDITOR)', () => {
    let createdFoodId: string;

    it('creates a new verified food item and logs audit action', async () => {
      const res = await request(app)
        .post('/api/v1/admin/foods')
        .set('Authorization', `Bearer ${TOKEN_NUTRITION_EDITOR}`)
        .send({
          name: 'Admin Test Paneer Tikka Masala',
          cuisine: 'INDIAN_NORTH',
          servingSize: 200,
          servingUnit: 'g',
          calories: 320,
          proteinG: 18,
          carbsG: 12,
          fatG: 22,
          fiberG: 4,
          isVerified: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Admin Test Paneer Tikka Masala');
      createdFoodId = res.body.data.id;

      // Verify audit log
      const audit = await prisma.adminAuditLog.findFirst({
        where: { action: 'FOOD_CREATE', targetId: createdFoodId },
      });
      expect(audit).not.toBeNull();
      expect(audit?.adminId).toBe(nutritionEditorId);
    });

    it('updates food item nutritional values', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/foods/${createdFoodId}`)
        .set('Authorization', `Bearer ${TOKEN_NUTRITION_EDITOR}`)
        .send({
          calories: 330,
          proteinG: 20,
        });

      expect(res.status).toBe(200);
      expect(Number(res.body.data.calories)).toBe(330);
      expect(Number(res.body.data.protein)).toBe(20);
    });

    it('deletes food item and records audit log', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/foods/${createdFoodId}`)
        .set('Authorization', `Bearer ${TOKEN_NUTRITION_EDITOR}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdFoodId);

      const check = await prisma.foodItem.findUnique({ where: { id: createdFoodId } });
      expect(check).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Scan Operations & Failure Safe Retries
  // ---------------------------------------------------------------------------
  describe('Scan Operations & Job Retries', () => {
    let failedScanId: string;

    beforeAll(async () => {
      const scan = await prisma.foodScanLog.create({
        data: {
          userId: testTargetUserId,
          storageKey: 'uploads/scans/test-failed-scan.jpg',
          status: 'FAILED',
          errorMessage: 'Provider timeout in Gemini Flash API',
          failureReason: 'AI_TIMEOUT',
          latencyMs: 15200,
        },
      });
      failedScanId = scan.id;
    });

    it('lists scan logs with status filtering', async () => {
      const res = await request(app)
        .get('/api/v1/admin/scans?status=FAILED')
        .set('Authorization', `Bearer ${TOKEN_SUPPORT_ADMIN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((s: any) => s.id === failedScanId);
      expect(found).toBeDefined();
    });

    it('safely resets a failed scan to PENDING for re-processing', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/scans/${failedScanId}/retry`)
        .set('Authorization', `Bearer ${TOKEN_OPS_ADMIN}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.errorMessage).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. AI Telemetry & Cost Monitoring
  // ---------------------------------------------------------------------------
  describe('AI Management & Telemetry', () => {
    it('returns AI model token aggregations, cost estimates, and provider breakdown', async () => {
      const res = await request(app)
        .get('/api/v1/admin/ai/telemetry')
        .set('Authorization', `Bearer ${TOKEN_OPS_ADMIN}`);

      expect(res.status).toBe(200);
      expect(res.body.data.activeModel).toBe('gemini-2.5-flash');
      expect(res.body.data).toHaveProperty('totalTokens');
      expect(res.body.data).toHaveProperty('estimatedCostUsd');
      expect(Array.isArray(res.body.data.providerBreakdown)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Notification Campaigns
  // ---------------------------------------------------------------------------
  describe('Notification Campaigns Management', () => {
    let campaignId: string;

    it('creates and lists notification campaigns', async () => {
      const res = await request(app)
        .post('/api/v1/admin/campaigns')
        .set('Authorization', `Bearer ${TOKEN_OPS_ADMIN}`)
        .send({
          title: 'Diwali Special Health Tips',
          body: 'Stay energized this festive season with smart portion tracking!',
          category: 'DAILY_SUMMARY',
          targetAudience: 'ALL',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Diwali Special Health Tips');
      campaignId = res.body.data.id;

      const listRes = await request(app)
        .get('/api/v1/admin/campaigns')
        .set('Authorization', `Bearer ${TOKEN_OPS_ADMIN}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((c: any) => c.id === campaignId)).toBe(true);
    });

    it('dispatches campaign and updates status to COMPLETED', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/campaigns/${campaignId}/dispatch`)
        .set('Authorization', `Bearer ${TOKEN_OPS_ADMIN}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Support Tickets & Internal Notes
  // ---------------------------------------------------------------------------
  describe('Customer Support Tickets', () => {
    let ticketId: string;

    it('creates a support ticket', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tickets')
        .set('Authorization', `Bearer ${TOKEN_SUPPORT_ADMIN}`)
        .send({
          userId: testTargetUserId,
          category: SupportTicketCategory.ACCOUNT_BILLING,
          priority: SupportTicketPriority.HIGH,
          subject: 'Subscription upgrade invoice query',
          message: 'User requesting VAT breakdown for annual subscription receipt.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.subject).toBe('Subscription upgrade invoice query');
      ticketId = res.body.data.id;
    });

    it('adds an internal admin note to the support ticket', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${TOKEN_SUPPORT_ADMIN}`)
        .send({
          note: 'Verified payment transaction ID on RevenueCat portal. Invoice re-sent.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.note).toContain('Verified payment transaction');
      expect(res.body.data.admin.email).toBe('supportadmin@calmeter.test');
    });

    it('updates ticket status and resolution notes', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${TOKEN_SUPPORT_ADMIN}`)
        .send({
          status: 'RESOLVED',
          resolutionNotes: 'Resolved directly with user via email with PDF invoice attached.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESOLVED');
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Admin User Provisioning & Roles (SUPER_ADMIN)
  // ---------------------------------------------------------------------------
  describe('Admin Role Management (SUPER_ADMIN Only)', () => {
    let newAdminId: string;
    const testAdminEmail = `newoperator_${Date.now()}@calmeter.test`;

    it('provisions a new administrator account', async () => {
      const res = await request(app)
        .post('/api/v1/admin/admins')
        .set('Authorization', `Bearer ${TOKEN_SUPER_ADMIN}`)
        .send({
          email: testAdminEmail,
          name: 'New Operator Admin',
          role: AdminRole.OPERATIONS_ADMIN,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe(testAdminEmail);
      expect(res.body.data.role).toBe(AdminRole.OPERATIONS_ADMIN);
      newAdminId = res.body.data.id;
    });

    it('updates administrator role', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/admins/${newAdminId}/role`)
        .set('Authorization', `Bearer ${TOKEN_SUPER_ADMIN}`)
        .send({ role: AdminRole.NUTRITION_EDITOR });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(AdminRole.NUTRITION_EDITOR);
    });

    it('disables administrator account', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/admins/${newAdminId}/status`)
        .set('Authorization', `Bearer ${TOKEN_SUPER_ADMIN}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('prevents self-suspension by an admin', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/admins/${superAdminId}/status`)
        .set('Authorization', `Bearer ${TOKEN_SUPER_ADMIN}`)
        .send({ isActive: false });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('cannot suspend their own account');
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Immutable Audit Trail
  // ---------------------------------------------------------------------------
  describe('Immutable Audit Logs', () => {
    it('retrieves immutable audit log events with actor and target tracking', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?page=1&limit=20')
        .set('Authorization', `Bearer ${TOKEN_OPS_ADMIN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const first = res.body.data[0];
      expect(first).toHaveProperty('action');
      expect(first).toHaveProperty('adminEmail');
      expect(first).toHaveProperty('createdAt');
    });
  });
});
