import { canUpdateAdminProfile, canViewAdmin } from '@/domain/auth/access/admin/permissions';
import { getRoleSummariesByIds } from '@/domain/auth/access/admin/role-queries';
import { formatAdminResponse } from '@/domain/auth/responses/admin.response';
import {
  findAdminById,
  updateAdminById,
} from '@/repositories/auth/admin.repository';
import { findUserById } from '@/repositories/auth/user.repository';
import { AuthError } from '@/domain/auth/errors';
import { recordAdminAction } from '@/domain/auth/admin/admin-audit';
import type { AdminAccessContext } from '@/domain/auth/queries/admin-context';
import type { AdminProfileUpdateInput } from '@/features/admin/profile/profile.schema';

const findAdminWithUser = async (targetUserId: string) => {
  const admin = await findAdminById(targetUserId);

  if (!admin) {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  const user = await findUserById(targetUserId);

  if (!user || user.role !== 'admin') {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  return { admin, user };
};

export const getAdminProfile = async (ctx: AdminAccessContext) => {
  return getAdminProfileByUserId(ctx, ctx.userId, ctx.userId);
};

export const getAdminProfileByUserId = async (
  ctx: AdminAccessContext,
  actorUserId: string,
  targetUserId: string
) => {
  if (!canViewAdmin(ctx, actorUserId, targetUserId)) {
    throw new AuthError(403, 'Bu admin profilini görüntüleme yetkin yok');
  }

  const { admin, user } = await findAdminWithUser(targetUserId);
  const rolesById = await getRoleSummariesByIds([String(admin.roleId)]);

  return formatAdminResponse(admin, user, rolesById.get(String(admin.roleId)));
};

export const updateAdminProfile = async (
  ctx: AdminAccessContext,
  actorUserId: string,
  targetUserId: string,
  data: AdminProfileUpdateInput
) => {
  if (!canUpdateAdminProfile(ctx, actorUserId, targetUserId)) {
    throw new AuthError(403, 'Bu admin profilini güncelleme yetkin yok');
  }

  await findAdminWithUser(targetUserId);

  const updatedAdmin = await updateAdminById(
    targetUserId,
    { $set: data },
    { returnDocument: 'after' }
  );

  if (!updatedAdmin) {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  await recordAdminAction({
    actorUserId: ctx.userId,
    action: 'admin.profile_updated',
    resourceType: 'admin',
    resourceId: targetUserId,
    metadata: data,
  });

  const user = await findUserById(targetUserId);

  if (!user) {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  const rolesById = await getRoleSummariesByIds([String(updatedAdmin.roleId)]);

  return formatAdminResponse(
    updatedAdmin,
    user,
    rolesById.get(String(updatedAdmin.roleId))
  );
};
