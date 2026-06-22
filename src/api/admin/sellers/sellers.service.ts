import { canManageSellerApproval, canReadSellers } from '@/domains/identity/application/access/admin/permissions';
import {
  sendSellerApprovedEmail,
  sendSellerRejectedEmail,
} from '@/domains/identity/application/admin/mail/send-seller-notifications';
import { isSellerProfileComplete } from '@/domains/identity/application/profile/profile-completion';
import { createLogger } from '@/shared/logging';
import type { SellerApprovalStatus } from '@/integrations/mongo';
import {
  approveSellerIfPending,
  findSellerById,
  findSellerByIdLean,
  listSellersLean,
  saveSellerDocument,
} from '@/domains/identity/infrastructure/repositories/seller.repository';
import {
  findUserById,
  findUserByIdLean,
  findUsersByIdsLean,
} from '@/domains/identity/infrastructure/repositories/auth/user.repository';
import { AuthError } from '@/domains/identity/application/errors';
import { recordAdminAction } from '@/domains/identity/application/admin/admin-audit';
import { getSellerWalletSummary } from '@/api/seller/wallet/wallet.service';
import {
  applyUserActiveStatus,
  recordUserActiveStatusChange,
} from '@/domains/identity/application/admin/user-active-status';
import { HttpError } from '@/shared/errors';
import type { SetUserActiveStatusInput } from '@/api/admin/common/set-user-active.schema';
import {
  enqueueOutboxEvent,
  OUTBOX_EVENT_TYPES,
} from '@/domains/notifications/application/outbox/enqueue-outbox-event';
import { createIyzicoSubMerchant } from '@/integrations/iyzico/create-submerchant';
import type { AdminAccessContext } from '@/domains/identity/application/queries/admin-context';

const assertCanManageSellerApproval = (ctx: AdminAccessContext) => {
  if (!canManageSellerApproval(ctx)) {
    throw new AuthError(403, 'Satıcı onaylama yetkin yok');
  }
};

const assertCanReadSellers = (ctx: AdminAccessContext) => {
  if (!canReadSellers(ctx)) {
    throw new AuthError(403, 'Satıcı listesini görüntüleme yetkin yok');
  }
};

const log = createLogger({ module: 'sellers-admin' });

const registerSellerIyzicoSubMerchant = async (
  seller: {
    _id: unknown;
    sellerType?: 'bireysel' | 'kurumsal' | null;
    companyType?: 'ltd' | 'as' | null;
    authorizedFirstName?: string | null;
    authorizedLastName?: string | null;
    companyPhone?: string | null;
    phone?: string | null;
    companyName?: string | null;
    taxNumber?: string | null;
    taxOffice?: string | null;
    companyAddress?: string | null;
    iban?: string | null;
    iyzicoSubMerchantKey?: string | null;
  },
  email: string,
  userId: string
): Promise<string> => {
  if (seller.iyzicoSubMerchantKey) {
    return seller.iyzicoSubMerchantKey;
  }

  try {
    return await createIyzicoSubMerchant({
      sellerId: String(seller._id),
      email,
      sellerType: seller.sellerType,
      companyType: seller.companyType,
      authorizedFirstName: seller.authorizedFirstName,
      authorizedLastName: seller.authorizedLastName,
      companyPhone: seller.companyPhone,
      phone: seller.phone,
      companyName: seller.companyName,
      taxNumber: seller.taxNumber,
      taxOffice: seller.taxOffice,
      companyAddress: seller.companyAddress,
      iban: seller.iban,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    if (error instanceof HttpError) {
      throw new AuthError(error.statusCode, 'Satıcı Iyzico alt üye kaydı oluşturulamadı');
    }

    log.error({ err: error, userId }, 'Iyzico alt üye kaydı oluşturulamadı');

    throw new AuthError(502, 'Satıcı Iyzico alt üye kaydı oluşturulamadı');
  }
};

export const listSellers = async (ctx: AdminAccessContext, status?: SellerApprovalStatus) => {
  assertCanReadSellers(ctx);

  const filter = status ? { approvalStatus: status } : {};

  const sellers = await listSellersLean(filter);

  const userIds = sellers.map((seller) => seller._id);
  const users = await findUsersByIdsLean(
    userIds.map(String),
    'email isEmailVerified createdAt'
  );

  const usersById = new Map(users.map((user) => [String(user._id), user]));

  return sellers.map((seller) => {
    const user = usersById.get(String(seller._id));

    return {
      userId: seller._id,
      email: user?.email,
      isEmailVerified: user?.isEmailVerified,
      createdAt: user?.createdAt,
      approvalStatus: seller.approvalStatus,
      rejectionReason: seller.rejectionReason,
      sellerType: seller.sellerType,
      companyName: seller.companyName,
      taxNumber: seller.taxNumber,
      country: seller.country,
      city: seller.city,
      iyzicoSubMerchantRegistered: Boolean(seller.iyzicoSubMerchantKey),
    };
  });
};

export const getSellerByUserId = async (ctx: AdminAccessContext, userId: string) => {
  assertCanReadSellers(ctx);

  const user = await findUserByIdLean(userId, 'email role isEmailVerified createdAt');

  if (!user || user.role !== 'seller') {
    throw new AuthError(404, 'Satıcı bulunamadı');
  }

  const profile = await findSellerByIdLean(userId);

  if (!profile) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  return {
    userId: user._id,
    email: String(user.email),
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    approvalStatus: profile.approvalStatus,
    rejectionReason: profile.rejectionReason,
    profile,
  };
};

export const getSellerWalletByUserId = async (ctx: AdminAccessContext, userId: string) => {
  assertCanReadSellers(ctx);
  await getSellerByUserId(ctx, userId);

  return getSellerWalletSummary(userId);
};

export const rejectSeller = async (
  ctx: AdminAccessContext,
  userId: string,
  reason: string
) => {
  assertCanManageSellerApproval(ctx);

  const user = await findUserByIdLean(userId, 'role email');

  if (!user || user.role !== 'seller') {
    throw new AuthError(404, 'Satıcı bulunamadı');
  }

  const seller = await findSellerById(userId);

  if (!seller) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  if (seller.approvalStatus !== 'pending') {
    throw new AuthError(400, 'Sadece onay bekleyen satıcılar reddedilebilir');
  }

  seller.approvalStatus = 'rejected';
  seller.rejectionReason = reason;
  await saveSellerDocument(seller);

  await recordAdminAction({
    actorUserId: ctx.userId,
    action: 'seller.rejected',
    resourceType: 'seller',
    resourceId: userId,
    metadata: { reason },
  });

  try {
    await sendSellerRejectedEmail(String(user.email), reason, seller.companyName);
  } catch (error) {
    log.error({ err: error, userId }, 'Satıcı red bildirimi gönderilemedi');
    await enqueueOutboxEvent(OUTBOX_EVENT_TYPES.EMAIL_SELLER_REJECTED, {
      email: String(user.email),
      reason,
      companyName: seller.companyName,
    });
  }

  return {
    userId: seller._id,
    approvalStatus: seller.approvalStatus,
    rejectionReason: seller.rejectionReason,
  };
};

export const approveSeller = async (ctx: AdminAccessContext, userId: string) => {
  assertCanManageSellerApproval(ctx);

  const user = await findUserByIdLean(userId, 'role email isEmailVerified');

  if (!user || user.role !== 'seller') {
    throw new AuthError(404, 'Satıcı bulunamadı');
  }

  if (!user.isEmailVerified) {
    throw new AuthError(400, 'Satıcı e-postası doğrulanmadan onaylanamaz');
  }

  const seller = await findSellerById(userId);

  if (!seller) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  if (seller.approvalStatus !== 'pending') {
    throw new AuthError(400, 'Sadece onay bekleyen satıcılar onaylanabilir');
  }

  if (!isSellerProfileComplete(seller.toObject())) {
    throw new AuthError(400, 'Satıcı profili ve belgeler tamamlanmadan onaylanamaz');
  }

  const subMerchantKey = await registerSellerIyzicoSubMerchant(seller, String(user.email), userId);

  const updated = await approveSellerIfPending(userId, {
    approvalStatus: 'approved',
    rejectionReason: null,
    iyzicoSubMerchantKey: subMerchantKey,
  });

  if (!updated) {
    throw new AuthError(409, 'Satıcı onayı başka bir işlem tarafından tamamlandı');
  }

  await recordAdminAction({
    actorUserId: ctx.userId,
    action: 'seller.approved',
    resourceType: 'seller',
    resourceId: userId,
  });

  try {
    await sendSellerApprovedEmail(String(user.email), updated.companyName);
  } catch (error) {
    log.error({ err: error, userId }, 'Satıcı onay bildirimi gönderilemedi');
    await enqueueOutboxEvent(OUTBOX_EVENT_TYPES.EMAIL_SELLER_APPROVED, {
      email: String(user.email),
      companyName: updated.companyName,
    });
  }

  return {
    userId: updated._id,
    approvalStatus: updated.approvalStatus,
  };
};

export const syncSellerIyzicoSubMerchant = async (ctx: AdminAccessContext, userId: string) => {
  assertCanManageSellerApproval(ctx);

  const user = await findUserByIdLean(userId, 'role email');

  if (!user || user.role !== 'seller') {
    throw new AuthError(404, 'Satıcı bulunamadı');
  }

  const seller = await findSellerById(userId);

  if (!seller) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  if (seller.approvalStatus !== 'approved') {
    throw new AuthError(400, 'Yalnızca onaylı satıcılar için Iyzico kaydı oluşturulabilir');
  }

  if (seller.iyzicoSubMerchantKey) {
    return {
      userId: seller._id,
      iyzicoSubMerchantRegistered: true,
      created: false as const,
    };
  }

  seller.iyzicoSubMerchantKey = await registerSellerIyzicoSubMerchant(
    seller,
    String(user.email),
    userId
  );
  await saveSellerDocument(seller);

  await recordAdminAction({
    actorUserId: ctx.userId,
    action: 'seller.iyzico_synced',
    resourceType: 'seller',
    resourceId: userId,
  });

  return {
    userId: seller._id,
    iyzicoSubMerchantRegistered: true,
    created: true as const,
  };
};

export const setSellerActiveStatus = async (
  ctx: AdminAccessContext,
  userId: string,
  input: SetUserActiveStatusInput
) => {
  if (!canManageSellerApproval(ctx)) {
    throw new AuthError(403, 'Satıcı hesap durumu değiştirme yetkin yok');
  }

  const seller = await findSellerByIdLean(userId);

  if (!seller) {
    throw new AuthError(404, 'Satıcı bulunamadı');
  }

  const updatedUser = await applyUserActiveStatus(userId, 'seller', input.isActive);

  if (!updatedUser) {
    throw new AuthError(404, 'Satıcı bulunamadı');
  }

  await recordUserActiveStatusChange(ctx.userId, userId, 'seller', input.isActive);

  return getSellerByUserId(ctx, userId);
};
