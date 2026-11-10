import { describe, it, expect } from 'vitest';
import {
  AdminRole,
  hasRequiredAdminRole,
  isSuperAdmin,
  canPerformCapability,
} from '../src/index.js';

describe('Admin Roles & RBAC Permission Utilities (Part 14)', () => {
  it('correctly ranks role hierarchy', () => {
    // SUPER_ADMIN satisfies all levels
    expect(hasRequiredAdminRole(AdminRole.SUPER_ADMIN, AdminRole.SUPER_ADMIN)).toBe(true);
    expect(hasRequiredAdminRole(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)).toBe(true);
    expect(hasRequiredAdminRole(AdminRole.SUPER_ADMIN, AdminRole.NUTRITION_EDITOR)).toBe(true);
    expect(hasRequiredAdminRole(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN)).toBe(true);

    // OPERATIONS_ADMIN satisfies operations and support, but not super admin
    expect(hasRequiredAdminRole(AdminRole.OPERATIONS_ADMIN, AdminRole.OPERATIONS_ADMIN)).toBe(true);
    expect(hasRequiredAdminRole(AdminRole.OPERATIONS_ADMIN, AdminRole.SUPPORT_ADMIN)).toBe(true);
    expect(hasRequiredAdminRole(AdminRole.OPERATIONS_ADMIN, AdminRole.SUPER_ADMIN)).toBe(false);

    // SUPPORT_ADMIN only satisfies support admin
    expect(hasRequiredAdminRole(AdminRole.SUPPORT_ADMIN, AdminRole.SUPPORT_ADMIN)).toBe(true);
    expect(hasRequiredAdminRole(AdminRole.SUPPORT_ADMIN, AdminRole.OPERATIONS_ADMIN)).toBe(false);
    expect(hasRequiredAdminRole(AdminRole.SUPPORT_ADMIN, AdminRole.SUPER_ADMIN)).toBe(false);
  });

  it('verifies Super Admin status', () => {
    expect(isSuperAdmin(AdminRole.SUPER_ADMIN)).toBe(true);
    expect(isSuperAdmin(AdminRole.OPERATIONS_ADMIN)).toBe(false);
    expect(isSuperAdmin(AdminRole.NUTRITION_EDITOR)).toBe(false);
    expect(isSuperAdmin(AdminRole.SUPPORT_ADMIN)).toBe(false);
  });

  it('evaluates fine-grained role capabilities accurately', () => {
    expect(canPerformCapability(AdminRole.SUPER_ADMIN, 'manage_admins')).toBe(true);
    expect(canPerformCapability(AdminRole.SUPER_ADMIN, 'view_audit_logs')).toBe(true);
    expect(canPerformCapability(AdminRole.OPERATIONS_ADMIN, 'manage_admins')).toBe(false);
    expect(canPerformCapability(AdminRole.OPERATIONS_ADMIN, 'suspend_users')).toBe(true);
    expect(canPerformCapability(AdminRole.NUTRITION_EDITOR, 'manage_food')).toBe(true);
    expect(canPerformCapability(AdminRole.NUTRITION_EDITOR, 'suspend_users')).toBe(false);
    expect(canPerformCapability(AdminRole.SUPPORT_ADMIN, 'manage_support')).toBe(true);
    expect(canPerformCapability(AdminRole.SUPPORT_ADMIN, 'manage_food')).toBe(false);
  });
});
