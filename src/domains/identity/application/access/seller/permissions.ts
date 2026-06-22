import type { SellerPermissionKey } from '@/domains/identity/application/access/seller/permission-keys';
import { SELLER_PERMISSIONS } from '@/domains/identity/application/access/seller/permission-keys';
import type { SellerAccessContext } from '@/domains/identity/application/queries/seller-context';
import { AuthError } from '@/domains/identity/application/errors';

export const hasSellerPermission = (ctx: SellerAccessContext, permission: SellerPermissionKey) =>
  ctx.permissions.has(permission);

export const assertSellerPermission = (
  ctx: SellerAccessContext,
  permission: SellerPermissionKey,
  message: string
) => {
  if (!hasSellerPermission(ctx, permission)) {
    throw new AuthError(403, message);
  }
};

export const assertSellerOwner = (ctx: SellerAccessContext, message: string) => {
  if (!ctx.isOwner) {
    throw new AuthError(403, message);
  }
};

export const canReadSellerMembers = (ctx: SellerAccessContext) =>
  hasSellerPermission(ctx, SELLER_PERMISSIONS.MEMBERS_READ);

export const canWriteSellerMembers = (ctx: SellerAccessContext) => ctx.isOwner;

export const canDeleteSellerMembers = (ctx: SellerAccessContext) => ctx.isOwner;

export const canReadSellerRoles = (ctx: SellerAccessContext) =>
  hasSellerPermission(ctx, SELLER_PERMISSIONS.ROLES_READ);

export const canWriteSellerRoles = (ctx: SellerAccessContext) => ctx.isOwner;

export const canDeleteSellerRoles = (ctx: SellerAccessContext) => ctx.isOwner;

export const canViewSellerMember = (
  ctx: SellerAccessContext,
  actorUserId: string,
  targetUserId: string
) => actorUserId === targetUserId || hasSellerPermission(ctx, SELLER_PERMISSIONS.MEMBERS_READ);

export const canUpdateSellerMemberRole = (
  ctx: SellerAccessContext,
  actorUserId: string,
  targetUserId: string
) => actorUserId !== targetUserId && ctx.isOwner;

export const canUpdateSellerMemberProfile = (
  ctx: SellerAccessContext,
  actorUserId: string,
  targetUserId: string
) =>
  actorUserId === targetUserId ||
  hasSellerPermission(ctx, SELLER_PERMISSIONS.MEMBERS_WRITE) ||
  ctx.isOwner;

export const canReadCompanyProfile = (ctx: SellerAccessContext) =>
  hasSellerPermission(ctx, SELLER_PERMISSIONS.COMPANY_READ);

export const canWriteCompanyProfile = (ctx: SellerAccessContext) =>
  hasSellerPermission(ctx, SELLER_PERMISSIONS.COMPANY_WRITE);

export const canReadProducts = (ctx: SellerAccessContext) =>
  hasSellerPermission(ctx, SELLER_PERMISSIONS.PRODUCTS_READ);

export const canWriteProducts = (ctx: SellerAccessContext) =>
  hasSellerPermission(ctx, SELLER_PERMISSIONS.PRODUCTS_WRITE);

export const canReadOrders = (ctx: SellerAccessContext) =>
  hasSellerPermission(ctx, SELLER_PERMISSIONS.ORDERS_READ);

export const canWriteOrders = (ctx: SellerAccessContext) =>
  hasSellerPermission(ctx, SELLER_PERMISSIONS.ORDERS_WRITE);
