import { canUpdateAdminProfile, canViewAdmin } from '../../access/permissions';
import { formatAdminResponse } from '../../../shared/responses/admin.response';
import { Admin, User, type AdminRole } from '../../../../../db';
import { AuthError } from '../../../shared/errors';
import type { AdminProfileUpdateInput } from '../../../schemas/admin/admin-profile-fields.schema';

const findAdminWithUser = async (targetUserId: string) => {
  const admin = await Admin.findOne({ userId: targetUserId });

  if (!admin) {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  const user = await User.findById(targetUserId).select('email role isEmailVerified createdAt');

  if (!user || user.role !== 'admin') {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  return { admin, user };
};

export const getAdminProfile = async (actorRole: AdminRole, actorUserId: string) => {
  return getAdminProfileByUserId(actorRole, actorUserId, actorUserId);
};

export const getAdminProfileByUserId = async (
  actorRole: AdminRole,
  actorUserId: string,
  targetUserId: string
) => {
  if (!canViewAdmin(actorRole, actorUserId, targetUserId)) {
    throw new AuthError(403, 'Bu admin profilini görüntüleme yetkin yok');
  }

  const { admin, user } = await findAdminWithUser(targetUserId);
  return formatAdminResponse(admin, user);
};

export const updateAdminProfile = async (
  actorRole: AdminRole,
  actorUserId: string,
  targetUserId: string,
  data: AdminProfileUpdateInput
) => {
  if (!canUpdateAdminProfile(actorRole, actorUserId, targetUserId)) {
    throw new AuthError(403, 'Bu admin profilini güncelleme yetkin yok');
  }

  await findAdminWithUser(targetUserId);

  const updatedAdmin = await Admin.findOneAndUpdate(
    { userId: targetUserId },
    { $set: data },
    { returnDocument: 'after' }
  );

  if (!updatedAdmin) {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  const user = await User.findById(targetUserId).select('email isEmailVerified createdAt');

  if (!user) {
    throw new AuthError(404, 'Admin bulunamadı');
  }

  return formatAdminResponse(updatedAdmin, user);
};
