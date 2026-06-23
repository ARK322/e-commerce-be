import {
  canCreateAdmin,
  canDeleteAdmin,
  canUpdateAdminRoleId,
  canViewAdmin,
} from '@/domain/auth/access/admin/permissions';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { assertPermission } from '@/domain/auth/access/admin/permissions';
import {
  assertAssignableRoleId,
  countOwnerAdmins,
  getRoleSummariesByIds,
  isOwnerRoleId,
} from '@/domain/auth/access/admin/role-queries';
import { formatAdminResponse } from '@/domain/auth/responses/admin.response';
import { hashPassword } from '@/shared/security';
import { createUserId } from '@/shared/ids';
import {
  createAdmin as createAdminRecord,
  deleteAdminById,
  findAdminById,
  listAdminsLean,
  saveAdminDocument,
} from '@/repositories/auth/admin.repository';
import {
  createUser,
  deleteUserById,
  findUserByEmail,
  findUserById,
  findUsersByIdsLean,
} from '@/repositories/auth/user.repository';
import { AuthError, isDuplicateKeyError } from '@/domain/auth/errors';
import { recordAdminAction } from '@/domain/auth/admin/admin-audit';
import type { AdminProfileFields } from '@/domain/auth/profile/admin-profile.schema';
import type { AdminAccessContext } from '@/domain/auth/queries/admin-context';

export type CreateAdminInput = AdminProfileFields & {
  email: string;
  password: string;
  roleId: string;
};

export type UpdateAdminInput = {
  roleId: string;
};

export type SetUserActiveStatusInput = {
  isActive: boolean;
};
import {
  applyUserActiveStatus,
  recordUserActiveStatusChange,
} from '@/domain/auth/admin/user-active-status';

const findAdminRecord = async (targetUserId: string) => {
  const targetAdmin = await findAdminById(targetUserId);

  if (!targetAdmin) {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  const targetUser = await findUserById(targetUserId);

  if (!targetUser || targetUser.role !== 'admin') {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  return { targetAdmin, targetUser };
};

export const getAdminByUserId = async (
  ctx: AdminAccessContext,
  actorUserId: string,
  targetUserId: string
) => {
  if (!canViewAdmin(ctx, actorUserId, targetUserId)) {
    throw new AuthError(403, 'Bu admin profilini görüntüleme yetkin yok');
  }

  const { targetAdmin, targetUser } = await findAdminRecord(targetUserId);
  const rolesById = await getRoleSummariesByIds([String(targetAdmin.roleId)]);

  return formatAdminResponse(targetAdmin, targetUser, rolesById.get(String(targetAdmin.roleId)));
};

export const updateAdmin = async (
  ctx: AdminAccessContext,
  actorUserId: string,
  targetUserId: string,
  data: UpdateAdminInput
) => {
  if (!canUpdateAdminRoleId(ctx, actorUserId, targetUserId)) {
    throw new AuthError(403, 'Bu admin rolünü güncelleme yetkin yok');
  }

  await assertAssignableRoleId(data.roleId);

  const { targetAdmin, targetUser } = await findAdminRecord(targetUserId);

  if (String(targetAdmin.roleId) === data.roleId) {
    const rolesById = await getRoleSummariesByIds([data.roleId]);
    return formatAdminResponse(targetAdmin, targetUser, rolesById.get(data.roleId));
  }

  const currentlyOwner = await isOwnerRoleId(String(targetAdmin.roleId));

  if (currentlyOwner) {
    const ownerCount = await countOwnerAdmins();

    if (ownerCount <= 1) {
      throw new AuthError(400, 'Son owner rolü değiştirilemez');
    }
  }

  const previousRoleId = String(targetAdmin.roleId);
  targetAdmin.roleId = data.roleId;
  await saveAdminDocument(targetAdmin);

  await recordAdminAction({
    actorUserId: ctx.userId,
    action: 'admin.role_updated',
    resourceType: 'admin',
    resourceId: targetUserId,
    metadata: {
      previousRoleId,
      roleId: data.roleId,
    },
  });

  const rolesById = await getRoleSummariesByIds([data.roleId]);

  return formatAdminResponse(targetAdmin, targetUser, rolesById.get(data.roleId));
};

export const listAdmins = async (ctx: AdminAccessContext) => {
  assertPermission(ctx, PERMISSIONS.ADMINS_READ, 'Admin listesini görüntüleme yetkin yok');

  const admins = await listAdminsLean();
  const userIds = admins.map((admin) => admin._id);
  const roleIds = admins.map((admin) => String(admin.roleId));
  const users = await findUsersByIdsLean(
    userIds.map(String),
    'email isEmailVerified createdAt'
  );
  const rolesById = await getRoleSummariesByIds(roleIds);

  const usersById = new Map(users.map((user) => [String(user._id), user]));

  return admins.map((admin) => {
    const user = usersById.get(String(admin._id));
    return formatAdminResponse(admin, user, rolesById.get(String(admin.roleId)));
  });
};

export const createAdmin = async (ctx: AdminAccessContext, data: CreateAdminInput) => {
  if (!canCreateAdmin(ctx)) {
    throw new AuthError(403, 'Admin oluşturma yetkisi sadece owner\'da');
  }

  await assertAssignableRoleId(data.roleId);

  const existing = await findUserByEmail(data.email);

  if (existing) {
    throw new AuthError(409, 'Bu e-posta adresi zaten kayıtlı');
  }

  const hashedPassword = await hashPassword(data.password);
  const userId = createUserId();

  try {
    const user = await createUser({
      _id: userId,
      email: data.email,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isEmailVerified: true,
    });

    const admin = await createAdminRecord({
      _id: userId,
      roleId: data.roleId,
      createdBy: ctx.userId,
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
    });

    const rolesById = await getRoleSummariesByIds([data.roleId]);

    await recordAdminAction({
      actorUserId: ctx.userId,
      action: 'admin.created',
      resourceType: 'admin',
      resourceId: String(userId),
      metadata: { roleId: data.roleId, email: data.email },
    });

    return formatAdminResponse(admin, user, rolesById.get(data.roleId));
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AuthError(409, 'Bu e-posta adresi zaten kayıtlı');
    }

    throw error;
  }
};

export const deleteAdmin = async (ctx: AdminAccessContext, targetUserId: string) => {
  if (!canDeleteAdmin(ctx)) {
    throw new AuthError(403, 'Admin silme yetkisi sadece owner\'da');
  }

  const targetAdmin = await findAdminById(targetUserId);

  if (!targetAdmin) {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  const targetUser = await findUserById(targetUserId);

  if (!targetUser || targetUser.role !== 'admin') {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  if (await isOwnerRoleId(String(targetAdmin.roleId))) {
    const ownerCount = await countOwnerAdmins();

    if (ownerCount <= 1) {
      throw new AuthError(400, 'Son owner silinemez');
    }
  }

  await deleteAdminById(targetUserId);
  await deleteUserById(targetUserId);

  await recordAdminAction({
    actorUserId: ctx.userId,
    action: 'admin.deleted',
    resourceType: 'admin',
    resourceId: targetUserId,
    metadata: { roleId: String(targetAdmin.roleId) },
  });

  return { userId: targetUserId };
};

export const setAdminActiveStatus = async (
  ctx: AdminAccessContext,
  actorUserId: string,
  targetUserId: string,
  input: SetUserActiveStatusInput
) => {
  if (!ctx.isOwner) {
    throw new AuthError(403, 'Hesap durumu değiştirme yetkisi sadece owner\'da');
  }

  if (actorUserId === targetUserId) {
    throw new AuthError(400, 'Kendi hesap durumunu bu yolla değiştiremezsin');
  }

  const { targetAdmin } = await findAdminRecord(targetUserId);

  if (!input.isActive && (await isOwnerRoleId(String(targetAdmin.roleId)))) {
    const ownerCount = await countOwnerAdmins();

    if (ownerCount <= 1) {
      throw new AuthError(400, 'Son owner hesabı devre dışı bırakılamaz');
    }
  }

  const updatedUser = await applyUserActiveStatus(targetUserId, 'admin', input.isActive);

  if (!updatedUser) {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  await recordUserActiveStatusChange(ctx.userId, targetUserId, 'admin', input.isActive);

  const rolesById = await getRoleSummariesByIds([String(targetAdmin.roleId)]);

  return formatAdminResponse(targetAdmin, updatedUser, rolesById.get(String(targetAdmin.roleId)));
};
