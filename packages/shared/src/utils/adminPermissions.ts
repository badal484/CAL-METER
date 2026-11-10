import { AdminRole } from '../constants/enums.js';

/**
 * Role hierarchy ranking for CAL METER Enterprise Administration.
 * SUPER_ADMIN has full administrative authority across all domains.
 */
export const ADMIN_ROLE_RANK: Record<AdminRole, number> = {
  [AdminRole.SUPPORT_ADMIN]: 1,
  [AdminRole.NUTRITION_EDITOR]: 2,
  [AdminRole.OPERATIONS_ADMIN]: 3,
  [AdminRole.SUPER_ADMIN]: 4,
};

/**
 * Checks whether an administrator's assigned role satisfies the minimum required rank.
 */
export function hasRequiredAdminRole(userRole: AdminRole, requiredRole: AdminRole): boolean {
  const userRank = ADMIN_ROLE_RANK[userRole] ?? 0;
  const requiredRank = ADMIN_ROLE_RANK[requiredRole] ?? 999;
  return userRank >= requiredRank;
}

/**
 * Verifies if the role is Super Admin.
 */
export function isSuperAdmin(role: AdminRole): boolean {
  return role === AdminRole.SUPER_ADMIN;
}

/**
 * Maps permissible admin capabilities per role.
 */
export const ROLE_CAPABILITIES = {
  [AdminRole.SUPER_ADMIN]: [
    'manage_admins',
    'view_audit_logs',
    'manage_system_config',
    'manage_users',
    'suspend_users',
    'manage_food',
    'manage_recipes',
    'manage_subscriptions',
    'manage_notifications',
    'manage_support',
    'retry_jobs',
    'view_metrics',
  ],
  [AdminRole.OPERATIONS_ADMIN]: [
    'view_audit_logs',
    'manage_users',
    'suspend_users',
    'manage_subscriptions',
    'manage_notifications',
    'manage_support',
    'retry_jobs',
    'view_metrics',
    'view_scans',
  ],
  [AdminRole.NUTRITION_EDITOR]: [
    'manage_food',
    'manage_recipes',
    'view_food_provenance',
    'verify_nutrition_data',
  ],
  [AdminRole.SUPPORT_ADMIN]: [
    'manage_support',
    'view_users_summary',
    'view_support_tickets',
    'update_ticket_status',
  ],
} as const;

export type AdminCapability = (typeof ROLE_CAPABILITIES)[keyof typeof ROLE_CAPABILITIES][number];

export function canPerformCapability(role: AdminRole, capability: AdminCapability): boolean {
  const capabilities = ROLE_CAPABILITIES[role] as readonly string[];
  return capabilities ? capabilities.includes(capability) : false;
}
