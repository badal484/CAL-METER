import { Router, type Request, type Response, type NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AdminRole } from '@calmeter/shared';
import {
  AdminUserListQuerySchema,
  SuspendUserInputSchema,
  CreateSupportTicketInputSchema,
  UpdateSupportTicketInputSchema,
  AddTicketNoteInputSchema,
  CreateNotificationCampaignInputSchema,
  CreateRecipeInputSchema,
  UpdateRecipeInputSchema,
  ProvisionAdminInputSchema,
  UpdateAdminRoleInputSchema,
} from '@calmeter/contracts';
import { getPrismaClient } from '../lib/prisma.js';
import { createAdminAuthMiddleware, requireAdminRole } from '../middleware/adminAuth.js';
import { AdminAuditService } from '../services/adminAudit.service.js';
import { AdminOperationsService, type AuditContext } from '../services/adminOperations.service.js';
import type { IFirebaseTokenVerifier } from '../lib/firebase.js';
import type { IPushNotificationProvider } from '../services/notificationDispatcher.service.js';

export interface AdminRouteOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
  pushProvider?: IPushNotificationProvider;
  auditService?: AdminAuditService;
  operationsService?: AdminOperationsService;
}

export function createAdminRoutes(options?: AdminRouteOptions): Router {
  const router = Router();
  const db = options?.prisma || getPrismaClient();
  const auditService = options?.auditService || new AdminAuditService(db);
  const ops =
    options?.operationsService ||
    new AdminOperationsService(db, auditService, options?.pushProvider);

  // Authenticate all admin requests with Firebase Admin token verification + AdminUser lookup
  const requireAdminAuth = createAdminAuthMiddleware(db, options?.verifier);
  router.use(requireAdminAuth);

  // Helper to extract audit context
  function getAuditContext(req: Request): AuditContext {
    return {
      adminId: req.admin!.id,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      requestId: (req.headers['x-request-id'] as string) || undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Self identity & Permissions
  // ---------------------------------------------------------------------------
  router.get('/me', (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: req.admin,
    });
  });

  // ---------------------------------------------------------------------------
  // 1. Dashboard Overview
  // ---------------------------------------------------------------------------
  router.get(
    '/dashboard/overview',
    requireAdminRole(AdminRole.SUPPORT_ADMIN),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const overview = await ops.getDashboardOverview();
        res.status(200).json({ success: true, data: overview });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 2. User Management
  // ---------------------------------------------------------------------------
  router.get(
    '/users',
    requireAdminRole(AdminRole.SUPPORT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = AdminUserListQuerySchema.parse(req.query);
        const result = await ops.listUsers(parsed);
        res.status(200).json({ success: true, data: result.users, pagination: result.pagination });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/users/:id',
    requireAdminRole(AdminRole.SUPPORT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = await ops.getUserDetails(req.params.id as string);
        res.status(200).json({ success: true, data: user });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/users/:id/suspend',
    requireAdminRole(AdminRole.OPERATIONS_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { reason } = SuspendUserInputSchema.parse(req.body);
        const result = await ops.suspendUser(req.params.id as string, reason, getAuditContext(req));
        res.status(200).json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/users/:id/reactivate',
    requireAdminRole(AdminRole.OPERATIONS_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const reason = req.body.reason ? String(req.body.reason) : undefined;
        const result = await ops.reactivateUser(
          req.params.id as string,
          reason,
          getAuditContext(req),
        );
        res.status(200).json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 3. Food Database Management
  // ---------------------------------------------------------------------------
  router.get(
    '/foods',
    requireAdminRole(AdminRole.NUTRITION_EDITOR),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
        const search = req.query.search ? String(req.query.search) : undefined;
        const cuisine = req.query.cuisine ? String(req.query.cuisine) : undefined;
        const isVerified =
          req.query.isVerified !== undefined ? req.query.isVerified === 'true' : undefined;

        const result = await ops.listFoods({ page, limit, search, cuisine, isVerified });
        res.status(200).json({ success: true, data: result.foods, pagination: result.pagination });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/foods/:id',
    requireAdminRole(AdminRole.NUTRITION_EDITOR),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const food = await ops.getFoodDetails(req.params.id as string);
        res.status(200).json({ success: true, data: food });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/foods',
    requireAdminRole(AdminRole.NUTRITION_EDITOR),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const food = await ops.createFoodItem(req.body, getAuditContext(req));
        res.status(201).json({ success: true, data: food });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/foods/:id',
    requireAdminRole(AdminRole.NUTRITION_EDITOR),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const food = await ops.updateFoodItem(
          req.params.id as string,
          req.body,
          getAuditContext(req),
        );
        res.status(200).json({ success: true, data: food });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/foods/:id',
    requireAdminRole(AdminRole.NUTRITION_EDITOR),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await ops.deleteFoodItem(req.params.id as string, getAuditContext(req));
        res.status(200).json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 4. Scan Operations
  // ---------------------------------------------------------------------------
  router.get(
    '/scans',
    requireAdminRole(AdminRole.SUPPORT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
        const status = req.query.status ? String(req.query.status) : undefined;

        const result = await ops.listScans({ page, limit, status });
        res.status(200).json({ success: true, data: result.scans, pagination: result.pagination });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/scans/:id',
    requireAdminRole(AdminRole.SUPPORT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const scan = await ops.getScanDetails(req.params.id as string);
        res.status(200).json({ success: true, data: scan });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/scans/:id/retry',
    requireAdminRole(AdminRole.OPERATIONS_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await ops.retryScan(req.params.id as string, getAuditContext(req));
        res.status(200).json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 5. AI Telemetry & Cost Inspection
  // ---------------------------------------------------------------------------
  router.get(
    '/ai/telemetry',
    requireAdminRole(AdminRole.OPERATIONS_ADMIN),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const telemetry = await ops.getAiTelemetry();
        res.status(200).json({ success: true, data: telemetry });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 6. Subscriptions & Webhook Events
  // ---------------------------------------------------------------------------
  router.get(
    '/subscriptions',
    requireAdminRole(AdminRole.SUPPORT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
        const tier = req.query.tier ? String(req.query.tier) : undefined;

        const result = await ops.listSubscriptions({ page, limit, tier });
        res
          .status(200)
          .json({ success: true, data: result.subscriptions, pagination: result.pagination });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/subscriptions/webhooks',
    requireAdminRole(AdminRole.OPERATIONS_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

        const result = await ops.listWebhookEvents({ page, limit });
        res.status(200).json({ success: true, data: result.events, pagination: result.pagination });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/subscriptions/:id/reconcile',
    requireAdminRole(AdminRole.OPERATIONS_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await ops.reconcileSubscription(
          req.params.id as string,
          getAuditContext(req),
        );
        res.status(200).json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 7. Content & Recipes
  // ---------------------------------------------------------------------------
  router.get(
    '/recipes',
    requireAdminRole(AdminRole.NUTRITION_EDITOR),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
        const search = req.query.search ? String(req.query.search) : undefined;
        const cuisine = req.query.cuisine ? String(req.query.cuisine) : undefined;

        const result = await ops.listRecipes({ page, limit, search, cuisine });
        res
          .status(200)
          .json({ success: true, data: result.recipes, pagination: result.pagination });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/recipes/:id',
    requireAdminRole(AdminRole.NUTRITION_EDITOR),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const recipe = await ops.getRecipe(req.params.id as string);
        res.status(200).json({ success: true, data: recipe });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/recipes',
    requireAdminRole(AdminRole.NUTRITION_EDITOR),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = CreateRecipeInputSchema.parse(req.body);
        const recipe = await ops.createRecipe(input, getAuditContext(req));
        res.status(201).json({ success: true, data: recipe });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/recipes/:id',
    requireAdminRole(AdminRole.NUTRITION_EDITOR),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = UpdateRecipeInputSchema.parse(req.body);
        const recipe = await ops.updateRecipe(req.params.id as string, input, getAuditContext(req));
        res.status(200).json({ success: true, data: recipe });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/recipes/:id',
    requireAdminRole(AdminRole.NUTRITION_EDITOR),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await ops.deleteRecipe(req.params.id as string, getAuditContext(req));
        res.status(200).json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 8. Notification Campaigns
  // ---------------------------------------------------------------------------
  router.get(
    '/campaigns',
    requireAdminRole(AdminRole.OPERATIONS_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

        const result = await ops.listCampaigns({ page, limit });
        res
          .status(200)
          .json({ success: true, data: result.campaigns, pagination: result.pagination });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/campaigns',
    requireAdminRole(AdminRole.OPERATIONS_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = CreateNotificationCampaignInputSchema.parse(req.body);
        const campaign = await ops.createCampaign(input, getAuditContext(req));
        res.status(201).json({ success: true, data: campaign });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/campaigns/:id/dispatch',
    requireAdminRole(AdminRole.OPERATIONS_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const campaign = await ops.dispatchCampaign(req.params.id as string, getAuditContext(req));
        res.status(200).json({ success: true, data: campaign });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/campaigns/test',
    requireAdminRole(AdminRole.OPERATIONS_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { title, body, token } = req.body;
        const result = await ops.testNotification({ title, body, token }, getAuditContext(req));
        res.status(200).json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 9. Support Tickets
  // ---------------------------------------------------------------------------
  router.get(
    '/tickets',
    requireAdminRole(AdminRole.SUPPORT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

        const result = await ops.listTickets({
          page,
          limit,
          status: req.query.status as any,
          priority: req.query.priority as any,
          category: req.query.category as any,
        });
        res
          .status(200)
          .json({ success: true, data: result.tickets, pagination: result.pagination });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/tickets/:id',
    requireAdminRole(AdminRole.SUPPORT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ticket = await ops.getTicketDetails(req.params.id as string);
        res.status(200).json({ success: true, data: ticket });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/tickets',
    requireAdminRole(AdminRole.SUPPORT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = CreateSupportTicketInputSchema.parse(req.body);
        const ticket = await ops.createTicket(input, getAuditContext(req));
        res.status(201).json({ success: true, data: ticket });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/tickets/:id',
    requireAdminRole(AdminRole.SUPPORT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = UpdateSupportTicketInputSchema.parse(req.body);
        const ticket = await ops.updateTicket(req.params.id as string, input, getAuditContext(req));
        res.status(200).json({ success: true, data: ticket });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/tickets/:id/notes',
    requireAdminRole(AdminRole.SUPPORT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { note } = AddTicketNoteInputSchema.parse(req.body);
        const noteRecord = await ops.addTicketNote(
          req.params.id as string,
          note,
          getAuditContext(req),
        );
        res.status(201).json({ success: true, data: noteRecord });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 10. Admin User Provisioning & Roles (SUPER_ADMIN Only)
  // ---------------------------------------------------------------------------
  router.get(
    '/admins',
    requireAdminRole(AdminRole.SUPER_ADMIN),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const admins = await ops.listAdmins();
        res.status(200).json({ success: true, data: admins });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/admins',
    requireAdminRole(AdminRole.SUPER_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = ProvisionAdminInputSchema.parse(req.body);
        const admin = await ops.provisionAdmin(
          { ...input, firebaseUid: req.body.firebaseUid },
          getAuditContext(req),
        );
        res.status(201).json({ success: true, data: admin });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/admins/:id/role',
    requireAdminRole(AdminRole.SUPER_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { role } = UpdateAdminRoleInputSchema.parse(req.body);
        const admin = await ops.updateAdminRole(
          req.params.id as string,
          role,
          getAuditContext(req),
        );
        res.status(200).json({ success: true, data: admin });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/admins/:id/status',
    requireAdminRole(AdminRole.SUPER_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const isActive = Boolean(req.body.isActive);
        const admin = await ops.toggleAdminStatus(
          req.params.id as string,
          isActive,
          getAuditContext(req),
        );
        res.status(200).json({ success: true, data: admin });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 11. Immutable Audit Logs
  // ---------------------------------------------------------------------------
  router.get(
    '/audit-logs',
    requireAdminRole(AdminRole.OPERATIONS_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
        const action = req.query.action ? String(req.query.action) : undefined;
        const adminId = req.query.adminId ? String(req.query.adminId) : undefined;
        const targetResource = req.query.targetResource
          ? String(req.query.targetResource)
          : undefined;

        const result = await auditService.listLogs({
          page,
          limit,
          action,
          adminId,
          targetResource,
        });
        res.status(200).json({ success: true, data: result.logs, pagination: result.pagination });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 12. System Health & Infrastructure Monitoring
  // ---------------------------------------------------------------------------
  router.get(
    '/system/health',
    requireAdminRole(AdminRole.OPERATIONS_ADMIN),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const health = await ops.getSystemHealth();
        res.status(200).json({ success: true, data: health });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
