import {
  ASSIGNABLE_SELLER_PERMISSIONS,
  SELLER_OWNER_ONLY_PERMISSIONS,
  SELLER_PERMISSION_LABELS,
  type SellerPermissionKey,
} from '@/domains/identity/application/access/seller/permission-keys';
import {
  assertSellerOwner,
  canDeleteSellerRoles,
  canReadSellerRoles,
  canWriteSellerRoles,
} from '@/domains/identity/application/access/seller/permissions';
import { SELLER_SYSTEM_OWNER_ROLE_SLUG } from '@/integrations/mongo';
import { AuthError, isDuplicateKeyError } from '@/domains/identity/application/errors';
import type { SellerAccessContext } from '@/domains/identity/application/queries/seller-context';
import { createUserId } from '@/shared/ids';
import type {
  CreateSellerRoleInput,
  UpdateSellerRoleInput,
} from '@/api/seller/roles/create-role.schema';
import { countSellerMembersByCompanyAndRoleId } from '@/domains/identity/infrastructure/repositories/seller-member.repository';
import {
  createSellerRole as createSellerRoleRecord,
  deleteSellerRoleById,
  findSellerRoleByIdAndCompanyId,
  findSellerRoleByIdAndCompanyIdLean,
  findSellerRoleBySlugAndCompanyIdLean,
  listAssignableSellerRolesByCompanyIdLean,
  listSellerRolesByCompanyIdLean,
  saveSellerRoleDocument,
} from '@/domains/identity/infrastructure/repositories/seller-role.repository';

const formatRoleResponse = (role: {
  _id: unknown;
  name: string;
  slug: string;
  description?: string | null;
  permissions: string[];
  isSystem: boolean;
  createdBy?: unknown;
  createdAt?: Date;
}) => ({
  roleId: role._id,
  name: role.name,
  slug: role.slug,
  description: role.description ?? null,
  permissions: role.permissions,
  isSystem: role.isSystem,
  createdBy: role.createdBy ?? null,
  createdAt: role.createdAt,
});

export const listSellerPermissionRegistry = () =>
  ASSIGNABLE_SELLER_PERMISSIONS.map((key) => ({
    key,
    label: SELLER_PERMISSION_LABELS[key],
    ownerOnly: SELLER_OWNER_ONLY_PERMISSIONS.includes(key),
  }));

export const listSellerRoles = async (ctx: SellerAccessContext) => {
  if (!canReadSellerRoles(ctx)) {
    throw new AuthError(403, 'Rol listesini görüntüleme yetkin yok');
  }

  const roles = await listSellerRolesByCompanyIdLean(ctx.companyId);

  return roles.map(formatRoleResponse);
};

export const getSellerRoleById = async (ctx: SellerAccessContext, roleId: string) => {
  if (!canReadSellerRoles(ctx)) {
    throw new AuthError(403, 'Rol görüntüleme yetkin yok');
  }

  const role = await findSellerRoleByIdAndCompanyIdLean(ctx.companyId, roleId);

  if (!role) {
    throw new AuthError(404, 'Rol bulunamadı');
  }

  return formatRoleResponse(role);
};

export const createSellerRole = async (ctx: SellerAccessContext, data: CreateSellerRoleInput) => {
  if (!canWriteSellerRoles(ctx)) {
    throw new AuthError(403, 'Rol oluşturma yetkisi sadece şirket sahibinde');
  }

  if (data.slug === SELLER_SYSTEM_OWNER_ROLE_SLUG) {
    throw new AuthError(400, 'Bu slug sistem rolü için ayrılmış');
  }

  const existingSlug = await findSellerRoleBySlugAndCompanyIdLean(ctx.companyId, data.slug);

  if (existingSlug) {
    throw new AuthError(409, 'Bu slug zaten kullanılıyor');
  }

  try {
    const role = await createSellerRoleRecord({
      _id: createUserId(),
      sellerId: ctx.companyId,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      permissions: data.permissions,
      isSystem: false,
      createdBy: ctx.userId,
    });

    return formatRoleResponse(role);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AuthError(409, 'Bu slug zaten kullanılıyor');
    }

    throw error;
  }
};

export const updateSellerRole = async (
  ctx: SellerAccessContext,
  roleId: string,
  data: UpdateSellerRoleInput
) => {
  if (!canWriteSellerRoles(ctx)) {
    throw new AuthError(403, 'Rol güncelleme yetkisi sadece şirket sahibinde');
  }

  const role = await findSellerRoleByIdAndCompanyId(ctx.companyId, roleId);

  if (!role) {
    throw new AuthError(404, 'Rol bulunamadı');
  }

  if (role.isSystem) {
    throw new AuthError(400, 'Sistem rolü düzenlenemez');
  }

  if (data.name !== undefined) {
    role.name = data.name;
  }

  if (data.description !== undefined) {
    role.description = data.description;
  }

  if (data.permissions !== undefined) {
    role.permissions = data.permissions;
  }

  await saveSellerRoleDocument(role);

  return formatRoleResponse(role);
};

export const deleteSellerRole = async (ctx: SellerAccessContext, roleId: string) => {
  if (!canDeleteSellerRoles(ctx)) {
    throw new AuthError(403, 'Rol silme yetkisi sadece şirket sahibinde');
  }

  const role = await findSellerRoleByIdAndCompanyId(ctx.companyId, roleId);

  if (!role) {
    throw new AuthError(404, 'Rol bulunamadı');
  }

  if (role.isSystem) {
    throw new AuthError(400, 'Sistem rolü silinemez');
  }

  const assignedCount = await countSellerMembersByCompanyAndRoleId(ctx.companyId, roleId);

  if (assignedCount > 0) {
    throw new AuthError(400, 'Bu role atanmış çalışanlar var, rol silinemez');
  }

  await deleteSellerRoleById(roleId);

  return { roleId };
};

export {
  assertAssignableSellerRoleId,
  countOwnerSellerMembers,
  getSellerRoleSummariesByIds,
  isOwnerSellerRoleId,
  type SellerRoleSummary,
} from '@/domains/identity/application/access/seller/role-queries';

export const listAssignableSellerRoles = async (ctx: SellerAccessContext) => {
  assertSellerOwner(ctx, 'Rol listesini görüntüleme yetkisi sadece şirket sahibinde');

  const roles = await listAssignableSellerRolesByCompanyIdLean(
    ctx.companyId,
    SELLER_SYSTEM_OWNER_ROLE_SLUG
  );

  return roles.map(formatRoleResponse);
};
