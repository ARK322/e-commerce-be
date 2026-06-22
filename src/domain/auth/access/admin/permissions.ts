import type { PermissionKey } from '@/domain/auth/access/admin/permission-keys';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import type { AdminAccessContext } from '@/domain/auth/queries/admin-context';
import { AuthError } from '@/domain/auth/errors';

export const hasPermission = (ctx: AdminAccessContext, permission: PermissionKey) =>
  ctx.isOwner || ctx.permissions.has(permission);

export const assertPermission = (
  ctx: AdminAccessContext,
  permission: PermissionKey,
  message: string
) => {
  if (!hasPermission(ctx, permission)) {
    throw new AuthError(403, message);
  }
};

export const assertIsOwner = (ctx: AdminAccessContext, message: string) => {
  if (!ctx.isOwner) {
    throw new AuthError(403, message);
  }
};

export const canViewAdmin = (
  ctx: AdminAccessContext,
  actorUserId: string,
  targetUserId: string
) => {
  if (actorUserId === targetUserId) {
    return true;
  }

  return hasPermission(ctx, PERMISSIONS.ADMINS_READ);
};

export const canUpdateAdminProfile = (
  ctx: AdminAccessContext,
  actorUserId: string,
  targetUserId: string
) => {
  if (actorUserId === targetUserId) {
    return true;
  }

  return hasPermission(ctx, PERMISSIONS.ADMINS_WRITE);
};

export const canUpdateAdminRoleId = (
  ctx: AdminAccessContext,
  actorUserId: string,
  targetUserId: string
) => {
  if (actorUserId === targetUserId) {
    return false;
  }

  return ctx.isOwner;
};

export const canCreateAdmin = (ctx: AdminAccessContext) => ctx.isOwner;

export const canDeleteAdmin = (ctx: AdminAccessContext) => ctx.isOwner;

export const canManageSellerApproval = (ctx: AdminAccessContext) =>
  hasPermission(ctx, PERMISSIONS.SELLERS_APPROVE);

export const canReadSellers = (ctx: AdminAccessContext) =>
  hasPermission(ctx, PERMISSIONS.SELLERS_READ);

export const canReadCategories = (ctx: AdminAccessContext) =>
  hasPermission(ctx, PERMISSIONS.CATEGORIES_READ);

export const canWriteCategories = (ctx: AdminAccessContext) =>
  hasPermission(ctx, PERMISSIONS.CATEGORIES_WRITE);

export const canReadAdminRoles = (ctx: AdminAccessContext) =>
  hasPermission(ctx, PERMISSIONS.ADMIN_ROLES_READ);

export const canWriteAdminRoles = (ctx: AdminAccessContext) => ctx.isOwner;

export const canDeleteAdminRoles = (ctx: AdminAccessContext) => ctx.isOwner;

export const canReadOrders = (ctx: AdminAccessContext) =>
  hasPermission(ctx, PERMISSIONS.ORDERS_READ);

export const canReadSupport = (ctx: AdminAccessContext) =>
  hasPermission(ctx, PERMISSIONS.SUPPORT_READ);

export const canWriteSupport = (ctx: AdminAccessContext) =>
  hasPermission(ctx, PERMISSIONS.SUPPORT_WRITE);

export const canReadBuyers = (ctx: AdminAccessContext) =>
  hasPermission(ctx, PERMISSIONS.BUYERS_READ);

export const canReadFinance = (ctx: AdminAccessContext) =>
  hasPermission(ctx, PERMISSIONS.FINANCE_READ);

export const canExportFinance = (ctx: AdminAccessContext) =>
  hasPermission(ctx, PERMISSIONS.FINANCE_EXPORT);
