import type { PrismaClient } from '@prisma/client';
import { sanitizeAnalyticsProperties } from '@calmeter/shared';

export interface RecordAuditParams {
  adminId: string;
  action: string;
  targetResource: string;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  status?: 'SUCCESS' | 'FAILURE';
}

export class AdminAuditService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Appends an immutable audit event for an administrative operation.
   */
  async recordAction(params: RecordAuditParams) {
    const cleanDetails = params.details ? sanitizeAnalyticsProperties(params.details) : undefined;

    return this.prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetResource: params.targetResource,
        targetId: params.targetId ?? null,
        details: cleanDetails ? (cleanDetails as any) : undefined,
        reason: params.reason ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        requestId: params.requestId ?? null,
        status: params.status ?? 'SUCCESS',
      },
    });
  }

  /**
   * Lists audit logs with pagination and filtering.
   */
  async listLogs(params: {
    adminId?: string;
    action?: string;
    targetResource?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.adminId) where.adminId = params.adminId;
    if (params.action) where.action = params.action;
    if (params.targetResource) where.targetResource = params.targetResource;

    const [logs, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          admin: {
            select: {
              email: true,
              name: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return {
      logs: logs.map(log => ({
        id: log.id,
        adminId: log.adminId,
        adminEmail: log.admin.email,
        adminName: log.admin.name,
        action: log.action,
        targetResource: log.targetResource,
        targetId: log.targetId,
        details: log.details as Record<string, unknown> | null,
        reason: log.reason,
        ipAddress: log.ipAddress,
        status: log.status,
        createdAt: log.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
