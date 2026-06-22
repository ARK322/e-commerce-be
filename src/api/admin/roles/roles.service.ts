import {
  ASSIGNABLE_PERMISSIONS,
  OWNER_ONLY_PERMISSIONS,
  PERMISSION_LABELS,
  type PermissionKey,
} from '@/domains/identity/application/access/admin/permission-keys';
import {
  assertIsOwner,
  canDeleteAdminRoles,
  canReadAdminRoles,
  canWriteAdminRoles,
} from '@/domains/identity/application/access/admin/permissions';
import { SYSTEM_OWNER_ROLE_SLUG } from '@/integrations/mongo';
import {
  countAdminsByRoleId,
} from '@/domains/identity/infrastructure/repositories/auth/admin.repository';
import {
  createAdminRole as createAdminRoleRecord,
  deleteAdminRoleById,
  findAdminRoleById,
  findAdminRoleByIdLean,
  findAdminRoleBySlugLean,
  listAdminRolesLean,
  listAssignableAdminRolesLean,
  saveAdminRoleDocument,
} from '@/domains/identity/infrastructure/repositories/auth/admin-role.repository';
import { AuthError, isDuplicateKeyError } from '@/domains/identity/application/errors';
import { recordAdminAction } from '@/domains/identity/application/admin/admin-audit';
import type { AdminAccessContext } from '@/domains/identity/application/queries/admin-context';
import { createUserId } from '@/shared/ids';
import type { CreateAdminRoleInput } from '@/api/admin/roles/create-role.schema';
import type { UpdateAdminRoleInput } from '@/api/admin/roles/create-role.schema';

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

export const listPermissionRegistry = () =>
  ASSIGNABLE_PERMISSIONS.map((key) => ({
    key,
    label: PERMISSION_LABELS[key],
    ownerOnly: OWNER_ONLY_PERMISSIONS.includes(key),
  }));

export const listAdminRoles = async (ctx: AdminAccessContext) => {
  if (!canReadAdminRoles(ctx)) {
    throw new AuthError(403, 'Rol listesini görüntüleme yetkin yok');
  }

  const roles = await listAdminRolesLean();
  return roles.map(formatRoleResponse);
};

export const getAdminRoleById = async (ctx: AdminAccessContext, roleId: string) => {
  if (!canReadAdminRoles(ctx)) {
    throw new AuthError(403, 'Rol görüntüleme yetkin yok');
  }

  const role = await findAdminRoleByIdLean(roleId);

  if (!role) {
    throw new AuthError(404, 'Rol bulunamadı');
  }

  return formatRoleResponse(role);
};

export const createAdminRole = async (
  ctx: AdminAccessContext,
  data: CreateAdminRoleInput
) => {
  if (!canWriteAdminRoles(ctx)) {
    throw new AuthError(403, 'Rol oluşturma yetkisi sadece owner\'da');
  }

  if (data.slug === SYSTEM_OWNER_ROLE_SLUG) {
    throw new AuthError(400, 'Bu slug sistem rolü için ayrılmış');
  }

  const existingSlug = await findAdminRoleBySlugLean(data.slug);

  if (existingSlug) {
    throw new AuthError(409, 'Bu slug zaten kullanılıyor');
  }

  try {
    const role = await createAdminRoleRecord({
      _id: createUserId(),
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      permissions: data.permissions,
      isSystem: false,
      createdBy: ctx.userId,
    });

    await recordAdminAction({
      actorUserId: ctx.userId,
      action: 'admin_role.created',
      resourceType: 'admin_role',
      resourceId: String(role._id),
      metadata: { slug: role.slug, name: role.name },
    });

    return formatRoleResponse(role);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AuthError(409, 'Bu slug zaten kullanılıyor');
    }

    throw error;
  }
};

export const updateAdminRole = async (
  ctx: AdminAccessContext,
  roleId: string,
  data: UpdateAdminRoleInput
) => {
  if (!canWriteAdminRoles(ctx)) {
    throw new AuthError(403, 'Rol güncelleme yetkisi sadece owner\'da');
  }

  const role = await findAdminRoleById(roleId);

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

  await saveAdminRoleDocument(role);

  await recordAdminAction({
    actorUserId: ctx.userId,
    action: 'admin_role.updated',
    resourceType: 'admin_role',
    resourceId: roleId,
    metadata: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.permissions !== undefined ? { permissions: data.permissions } : {}),
    },
  });

  return formatRoleResponse(role);
};

export const deleteAdminRole = async (ctx: AdminAccessContext, roleId: string) => {
  if (!canDeleteAdminRoles(ctx)) {
    throw new AuthError(403, 'Rol silme yetkisi sadece owner\'da');
  }

  const role = await findAdminRoleById(roleId);

  if (!role) {
    throw new AuthError(404, 'Rol bulunamadı');
  }

  if (role.isSystem) {
    throw new AuthError(400, 'Sistem rolü silinemez');
  }

  const assignedCount = await countAdminsByRoleId(roleId);

  if (assignedCount > 0) {
    throw new AuthError(400, 'Bu role atanmış adminler var, rol silinemez');
  }

  await deleteAdminRoleById(roleId);

  await recordAdminAction({
    actorUserId: ctx.userId,
    action: 'admin_role.deleted',
    resourceType: 'admin_role',
    resourceId: roleId,
    metadata: { slug: role.slug, name: role.name },
  });

  return { roleId };
};

export {
  assertAssignableRoleId,
  countOwnerAdmins,
  getRoleSummariesByIds,
  isOwnerRoleId,
  type RoleSummary,
} from '@/domains/identity/application/access/admin/role-queries';

export const listAssignableRoles = async (ctx: AdminAccessContext) => {
  assertIsOwner(ctx, 'Rol listesini görüntüleme yetkisi sadece owner\'da');

  const roles = await listAssignableAdminRolesLean(SYSTEM_OWNER_ROLE_SLUG);

  return roles.map(formatRoleResponse);
};
