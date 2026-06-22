import { AuthError } from '@/domain/auth/errors';
import { recordAdminAction } from '@/domain/auth/admin/admin-audit';
import { revokeAllSessions } from '@/domain/auth/tokens/invalidate-all';
import { findUserById, updateUserById } from '@/repositories/auth/user.repository';

export const applyUserActiveStatus = async (
  userId: string,
  role: 'admin' | 'seller',
  isActive: boolean
) => {
  const user = await findUserById(userId);

  if (!user || user.role !== role) {
    throw new AuthError(404, role === 'admin' ? 'Admin bulunamadı' : 'Satıcı bulunamadı');
  }

  if (user.isActive === isActive) {
    return user;
  }

  await updateUserById(userId, { $set: { isActive } });

  if (!isActive) {
    await revokeAllSessions(userId);
  }

  return findUserById(userId);
};

export const recordUserActiveStatusChange = async (
  actorUserId: string,
  targetUserId: string,
  resourceType: 'admin' | 'seller',
  isActive: boolean
) => {
  await recordAdminAction({
    actorUserId,
    action: isActive ? 'user.reactivated' : 'user.deactivated',
    resourceType,
    resourceId: targetUserId,
  });
};
