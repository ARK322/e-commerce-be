import { canManageSellerApproval, canReadSellers } from '@/internal/auth/access/admin/permissions';
import {
  sendSellerApprovedEmail,
  sendSellerRejectedEmail,
} from '@/internal/auth/admin/mail/send-seller-notifications';
import { isSellerProfileComplete } from '@/internal/auth/profile/profile-completion';
import { createLogger } from '@/internal/common/logging';
import { Seller, User, type SellerApprovalStatus } from '@/integrations/mongo';
import { AuthError } from '@/internal/auth/errors';
import { HttpError } from '@/internal/common/errors';
import { createIyzicoSubMerchant } from '@/integrations/iyzico/create-submerchant';
import type { AdminAccessContext } from '@/internal/auth/queries/admin-context';

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

  const sellers = await Seller.find(filter)
    .sort({ _id: -1 })
    .lean();

  const userIds = sellers.map((seller) => seller._id);
  const users = await User.find({ _id: { $in: userIds } })
    .select('email isEmailVerified createdAt')
    .lean();

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

  const user = await User.findById(userId).select('email role isEmailVerified createdAt').lean();

  if (!user || user.role !== 'seller') {
    throw new AuthError(404, 'Satıcı bulunamadı');
  }

  const profile = await Seller.findById(userId).lean();

  if (!profile) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  return {
    userId: user._id,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    approvalStatus: profile.approvalStatus,
    rejectionReason: profile.rejectionReason,
    profile,
  };
};

export const rejectSeller = async (
  ctx: AdminAccessContext,
  userId: string,
  reason: string
) => {
  assertCanManageSellerApproval(ctx);

  const user = await User.findById(userId).select('role email').lean();

  if (!user || user.role !== 'seller') {
    throw new AuthError(404, 'Satıcı bulunamadı');
  }

  const seller = await Seller.findById(userId);

  if (!seller) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  if (seller.approvalStatus !== 'pending') {
    throw new AuthError(400, 'Sadece onay bekleyen satıcılar reddedilebilir');
  }

  seller.approvalStatus = 'rejected';
  seller.rejectionReason = reason;
  await seller.save();

  try {
    await sendSellerRejectedEmail(user.email, reason, seller.companyName);
  } catch (error) {
    log.error({ err: error, userId }, 'Satıcı red bildirimi gönderilemedi');
  }

  return {
    userId: seller._id,
    approvalStatus: seller.approvalStatus,
    rejectionReason: seller.rejectionReason,
  };
};

export const approveSeller = async (ctx: AdminAccessContext, userId: string) => {
  assertCanManageSellerApproval(ctx);

  const user = await User.findById(userId).select('role email isEmailVerified').lean();

  if (!user || user.role !== 'seller') {
    throw new AuthError(404, 'Satıcı bulunamadı');
  }

  if (!user.isEmailVerified) {
    throw new AuthError(400, 'Satıcı e-postası doğrulanmadan onaylanamaz');
  }

  const seller = await Seller.findById(userId);

  if (!seller) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  if (seller.approvalStatus !== 'pending') {
    throw new AuthError(400, 'Sadece onay bekleyen satıcılar onaylanabilir');
  }

  if (!isSellerProfileComplete(seller.toObject())) {
    throw new AuthError(400, 'Satıcı profili ve belgeler tamamlanmadan onaylanamaz');
  }

  const subMerchantKey = await registerSellerIyzicoSubMerchant(seller, user.email, userId);

  const updated = await Seller.findOneAndUpdate(
    { _id: userId, approvalStatus: 'pending' },
    {
      $set: {
        approvalStatus: 'approved',
        rejectionReason: null,
        iyzicoSubMerchantKey: subMerchantKey,
      },
    },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw new AuthError(409, 'Satıcı onayı başka bir işlem tarafından tamamlandı');
  }

  try {
    await sendSellerApprovedEmail(user.email, updated.companyName);
  } catch (error) {
    log.error({ err: error, userId }, 'Satıcı onay bildirimi gönderilemedi');
  }

  return {
    userId: updated._id,
    approvalStatus: updated.approvalStatus,
  };
};

export const syncSellerIyzicoSubMerchant = async (ctx: AdminAccessContext, userId: string) => {
  assertCanManageSellerApproval(ctx);

  const user = await User.findById(userId).select('role email').lean();

  if (!user || user.role !== 'seller') {
    throw new AuthError(404, 'Satıcı bulunamadı');
  }

  const seller = await Seller.findById(userId);

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
    user.email,
    userId
  );
  await seller.save();

  return {
    userId: seller._id,
    iyzicoSubMerchantRegistered: true,
    created: true as const,
  };
};
