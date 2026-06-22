import {
  canDeleteSellerMembers,
  canUpdateSellerMemberProfile,
  canUpdateSellerMemberRole,
  canViewSellerMember,
  assertSellerPermission,
} from '@/domain/auth/access/seller/permissions';
import { SELLER_PERMISSIONS } from '@/domain/auth/access/seller/permission-keys';
import {
  assertAssignableSellerRoleId,
  countOwnerSellerMembers,
  getSellerRoleSummariesByIds,
  isOwnerSellerRoleId,
} from '@/domain/auth/access/seller/role-queries';
import { hashPassword } from '@/shared/security';
import { createUserId } from '@/shared/ids';
import { AuthError, isDuplicateKeyError } from '@/domain/auth/errors';
import { sendSellerMemberInviteEmail } from '@/domain/auth/mail/send-member-invite';
import type { SellerAccessContext } from '@/domain/auth/queries/seller-context';
import type { CreateSellerMemberInput } from '@/features/sellers/members/create-member.schema';
import type {
  UpdateSellerMemberProfileInput,
  UpdateSellerMemberRoleInput,
} from '@/features/sellers/members/create-member.schema';
import { randomBytes } from 'crypto';
import {
  createSellerMember as createSellerMemberRecord,
  deleteSellerMemberById,
  findSellerMemberByCompanyAndUserId,
  listSellerMembersByCompanyIdLean,
  saveSellerMemberDocument,
  updateSellerMemberById,
} from '@/repositories/sellers/seller-member.repository';
import {
  createUser,
  deleteUserById,
  findUserByEmail,
  findUserByIdLean,
  findUsersByIdsLean,
} from '@/repositories/auth/user.repository';

const formatMemberResponse = (
  member: {
    _id: unknown;
    sellerId: string;
    roleId: string;
    isOwner: boolean;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    createdBy?: unknown;
    createdAt?: Date;
  },
  user?: { email?: string; isEmailVerified?: boolean; createdAt?: Date } | null,
  role?: { roleId: string; name: string; slug: string }
) => ({
  userId: member._id,
  email: user?.email,
  isEmailVerified: user?.isEmailVerified,
  companyId: member.sellerId,
  roleId: member.roleId,
  role: role ?? null,
  isOwner: member.isOwner,
  createdAt: user?.createdAt ?? member.createdAt,
  createdBy: member.createdBy ?? null,
  profile: {
    firstName: member.firstName ?? null,
    lastName: member.lastName ?? null,
    phone: member.phone ?? null,
  },
});

const findMemberRecord = async (companyId: string, targetUserId: string) => {
  const member = await findSellerMemberByCompanyAndUserId(companyId, targetUserId);

  if (!member) {
    throw new AuthError(404, 'Çalışan bulunamadı');
  }

  const user = await findUserByIdLean(targetUserId, 'email role isEmailVerified createdAt');

  if (!user || user.role !== 'seller') {
    throw new AuthError(404, 'Çalışan bulunamadı');
  }

  return { member, user };
};

export const getSellerMemberByUserId = async (
  ctx: SellerAccessContext,
  targetUserId: string
) => {
  if (!canViewSellerMember(ctx, ctx.userId, targetUserId)) {
    throw new AuthError(403, 'Bu çalışanı görüntüleme yetkin yok');
  }

  const { member, user } = await findMemberRecord(ctx.companyId, targetUserId);
  const rolesById = await getSellerRoleSummariesByIds(ctx.companyId, [String(member.roleId)]);

  return formatMemberResponse(member, user, rolesById.get(String(member.roleId)));
};

export const listSellerMembers = async (ctx: SellerAccessContext) => {
  assertSellerPermission(ctx, SELLER_PERMISSIONS.MEMBERS_READ, 'Ekip listesini görüntüleme yetkin yok');

  const members = await listSellerMembersByCompanyIdLean(ctx.companyId);

  const userIds = members.map((member) => String(member._id));
  const roleIds = members.map((member) => String(member.roleId));

  const users = await findUsersByIdsLean(userIds, 'email isEmailVerified createdAt');

  const rolesById = await getSellerRoleSummariesByIds(ctx.companyId, roleIds);
  const usersById = new Map(users.map((user) => [String(user._id), user]));

  return members.map((member) => {
    const user = usersById.get(String(member._id));
    return formatMemberResponse(member, user, rolesById.get(String(member.roleId)));
  });
};

export const createSellerMember = async (ctx: SellerAccessContext, data: CreateSellerMemberInput) => {
  if (!ctx.isOwner) {
    throw new AuthError(403, 'Çalışan davet etme yetkisi sadece şirket sahibinde');
  }

  if (ctx.approvalStatus !== 'approved') {
    throw new AuthError(403, 'Onaylı şirket hesabı olmadan çalışan eklenemez');
  }

  await assertAssignableSellerRoleId(ctx.companyId, data.roleId);

  const existing = await findUserByEmail(data.email);

  if (existing) {
    throw new AuthError(409, 'Bu e-posta adresi zaten kayıtlı');
  }

  const hashedPassword = await hashPassword(randomBytes(32).toString('hex'));
  const userId = createUserId();

  try {
    const user = await createUser({
      _id: userId,
      email: data.email,
      password: hashedPassword,
      role: 'seller',
      isActive: false,
      isEmailVerified: false,
    });

    const member = await createSellerMemberRecord({
      _id: userId,
      sellerId: ctx.companyId,
      roleId: data.roleId,
      isOwner: false,
      createdBy: ctx.userId,
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
    });

    try {
      await sendSellerMemberInviteEmail(userId, data.email);
    } catch {
      await deleteSellerMemberById(userId);
      await deleteUserById(userId);
      throw new AuthError(500, 'Davet e-postası gönderilemedi');
    }

    const rolesById = await getSellerRoleSummariesByIds(ctx.companyId, [data.roleId]);

    return formatMemberResponse(member, user, rolesById.get(data.roleId));
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AuthError(409, 'Bu e-posta adresi zaten kayıtlı');
    }

    throw error;
  }
};

export const updateSellerMemberRole = async (
  ctx: SellerAccessContext,
  targetUserId: string,
  data: UpdateSellerMemberRoleInput
) => {
  if (!canUpdateSellerMemberRole(ctx, ctx.userId, targetUserId)) {
    throw new AuthError(403, 'Bu çalışanın rolünü güncelleme yetkin yok');
  }

  await assertAssignableSellerRoleId(ctx.companyId, data.roleId);

  const { member, user } = await findMemberRecord(ctx.companyId, targetUserId);

  if (String(member.roleId) === data.roleId) {
    const rolesById = await getSellerRoleSummariesByIds(ctx.companyId, [data.roleId]);
    return formatMemberResponse(member, user, rolesById.get(data.roleId));
  }

  if (member.isOwner) {
    const ownerCount = await countOwnerSellerMembers(ctx.companyId);

    if (ownerCount <= 1) {
      throw new AuthError(400, 'Son şirket sahibinin rolü değiştirilemez');
    }
  }

  if (await isOwnerSellerRoleId(ctx.companyId, data.roleId)) {
    throw new AuthError(403, 'Owner rolü atanamaz');
  }

  member.roleId = data.roleId;
  member.isOwner = false;
  await saveSellerMemberDocument(member);

  const rolesById = await getSellerRoleSummariesByIds(ctx.companyId, [data.roleId]);

  return formatMemberResponse(member, user, rolesById.get(data.roleId));
};

export const updateSellerMemberProfile = async (
  ctx: SellerAccessContext,
  targetUserId: string,
  data: UpdateSellerMemberProfileInput
) => {
  if (!canUpdateSellerMemberProfile(ctx, ctx.userId, targetUserId)) {
    throw new AuthError(403, 'Bu çalışan profilini güncelleme yetkin yok');
  }

  await findMemberRecord(ctx.companyId, targetUserId);

  const updatedMember = await updateSellerMemberById(
    targetUserId,
    { $set: data },
    { returnDocument: 'after' }
  );

  if (!updatedMember) {
    throw new AuthError(404, 'Çalışan bulunamadı');
  }

  const user = await findUserByIdLean(targetUserId, 'email isEmailVerified createdAt');
  const rolesById = await getSellerRoleSummariesByIds(ctx.companyId, [String(updatedMember.roleId)]);

  return formatMemberResponse(
    updatedMember,
    user,
    rolesById.get(String(updatedMember.roleId))
  );
};

export const deleteSellerMember = async (ctx: SellerAccessContext, targetUserId: string) => {
  if (!canDeleteSellerMembers(ctx)) {
    throw new AuthError(403, 'Çalışan silme yetkisi sadece şirket sahibinde');
  }

  const member = await findSellerMemberByCompanyAndUserId(ctx.companyId, targetUserId);

  if (!member) {
    throw new AuthError(404, 'Çalışan bulunamadı');
  }

  if (member.isOwner) {
    const ownerCount = await countOwnerSellerMembers(ctx.companyId);

    if (ownerCount <= 1) {
      throw new AuthError(400, 'Son şirket sahibi silinemez');
    }
  }

  await deleteSellerMemberById(targetUserId);
  await deleteUserById(targetUserId);

  return { userId: targetUserId };
};
