import { canCreateAdminRole, canDeleteAdmin } from '../../../../lib/auth/admin-permissions';
import { hashPassword } from '../../../../lib/common/password';
import { Admin, User } from '../../../../db';
import type { AdminRole } from '../../../../db/auth/admin.model';
import { RegisterError, isDuplicateKeyError } from '../../register/register.errors';
import type { CreateAdminInput } from './schemas/create-admin.schema';

export const listAdmins = async () => {
  const admins = await Admin.find().sort({ createdAt: -1 }).lean();
  const userIds = admins.map((admin) => admin.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select('email isEmailVerified createdAt')
    .lean();

  const usersById = new Map(users.map((user) => [String(user._id), user]));

  return admins.map((admin) => {
    const user = usersById.get(String(admin.userId));

    return {
      userId: admin.userId,
      email: user?.email,
      isEmailVerified: user?.isEmailVerified,
      adminRole: admin.adminRole,
      createdAt: user?.createdAt ?? admin.createdAt,
      createdBy: admin.createdBy,
    };
  });
};

export const createAdmin = async (
  creatorUserId: string,
  creatorRole: AdminRole,
  data: CreateAdminInput
) => {
  if (!canCreateAdminRole(creatorRole, data.adminRole)) {
    throw new RegisterError(403, 'Bu admin rolünü oluşturma yetkin yok');
  }

  const existing = await User.findOne({ email: data.email.toLowerCase() });

  if (existing) {
    throw new RegisterError(409, 'Bu e-posta adresi zaten kayıtlı');
  }

  const hashedPassword = await hashPassword(data.password);

  try {
    const user = await User.create({
      email: data.email,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isEmailVerified: true,
    });

    const admin = await Admin.create({
      userId: user._id,
      adminRole: data.adminRole,
      createdBy: creatorUserId,
    });

    return {
      userId: user._id,
      email: user.email,
      adminRole: admin.adminRole,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new RegisterError(409, 'Bu e-posta adresi zaten kayıtlı');
    }

    throw error;
  }
};

export const deleteAdmin = async (actorRole: AdminRole, targetUserId: string) => {
  if (!canDeleteAdmin(actorRole)) {
    throw new RegisterError(403, 'Admin silme yetkisi sadece owner\'da');
  }

  const targetAdmin = await Admin.findOne({ userId: targetUserId });

  if (!targetAdmin) {
    throw new RegisterError(404, 'Admin bulunamadı');
  }

  const targetUser = await User.findById(targetUserId).select('role');

  if (!targetUser || targetUser.role !== 'admin') {
    throw new RegisterError(404, 'Admin bulunamadı');
  }

  if (targetAdmin.adminRole === 'owner') {
    const ownerCount = await Admin.countDocuments({ adminRole: 'owner' });

    if (ownerCount <= 1) {
      throw new RegisterError(400, 'Son owner silinemez');
    }
  }

  await Admin.deleteOne({ userId: targetUserId });
  await User.findByIdAndDelete(targetUserId);

  return { userId: targetUserId };
};
