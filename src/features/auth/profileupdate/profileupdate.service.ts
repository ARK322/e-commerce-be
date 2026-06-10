import type { AuthTokenPayload } from '../../../lib/auth/auth-token';
import { User, Buyer, Seller } from '../../../db';
import { RegisterError } from '../register/register.errors';
import { isBuyerProfileComplete, isSellerProfileComplete } from './profile-completion';
import { hasCriticalSellerFieldChanges } from './seller-critical-fields';
import type { BuyerProfileUpdateInput, SellerProfileUpdateInput } from './schemas';

const syncBuyerActiveStatus = async (userId: string, isComplete: boolean) => {
  await User.findByIdAndUpdate(userId, { isActive: isComplete });
  return isComplete;
};

const resolveBuyerBilling = (
  current: {
    deliveryAddress?: string | null;
    billingAddress?: string | null;
    billingSameAsDelivery?: boolean | null;
  },
  update: BuyerProfileUpdateInput
) => {
  const billingSameAsDelivery =
    update.billingSameAsDelivery ?? current.billingSameAsDelivery ?? false;
  const deliveryAddress = update.deliveryAddress ?? current.deliveryAddress ?? undefined;

  if (!billingSameAsDelivery) {
    return update.billingAddress !== undefined
      ? { billingAddress: update.billingAddress, billingSameAsDelivery }
      : { billingSameAsDelivery };
  }

  return {
    billingAddress: deliveryAddress,
    billingSameAsDelivery: true,
  };
};

export const getProfile = async (auth: AuthTokenPayload) => {
  const user = await User.findById(auth.userId).select('email role isActive isEmailVerified');

  if (!user) {
    throw new RegisterError(404, 'Kullanıcı bulunamadı');
  }

  if (auth.role === 'buyer') {
    const profile = await Buyer.findOne({ userId: auth.userId }).lean();

    if (!profile) {
      throw new RegisterError(404, 'Alıcı profili bulunamadı');
    }

    return {
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      profile,
    };
  }

  const profile = await Seller.findOne({ userId: auth.userId }).lean();

  if (!profile) {
    throw new RegisterError(404, 'Satıcı profili bulunamadı');
  }

  return {
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    approvalStatus: profile.approvalStatus,
    rejectionReason: profile.rejectionReason,
    profile,
  };
};

export const updateProfile = async (
  auth: AuthTokenPayload,
  data: BuyerProfileUpdateInput | SellerProfileUpdateInput
) => {
  if (auth.role === 'buyer') {
    return updateBuyerProfile(auth, data as BuyerProfileUpdateInput);
  }

  return updateSellerProfile(auth, data as SellerProfileUpdateInput);
};

const updateBuyerProfile = async (
  auth: AuthTokenPayload,
  data: BuyerProfileUpdateInput
) => {
  const buyer = await Buyer.findOne({ userId: auth.userId });

  if (!buyer) {
    throw new RegisterError(404, 'Alıcı profili bulunamadı');
  }

  const billingUpdate = resolveBuyerBilling(buyer, data);

  const updatedBuyer = await Buyer.findOneAndUpdate(
    { userId: auth.userId },
    { $set: { ...data, ...billingUpdate } },
    { new: true }
  );

  if (!updatedBuyer) {
    throw new RegisterError(404, 'Alıcı profili bulunamadı');
  }

  const isActive = await syncBuyerActiveStatus(
    auth.userId,
    isBuyerProfileComplete(updatedBuyer.toObject())
  );

  return { profile: updatedBuyer, isActive };
};

const updateSellerProfile = async (
  auth: AuthTokenPayload,
  data: SellerProfileUpdateInput
) => {
  const seller = await Seller.findOne({ userId: auth.userId });

  if (!seller) {
    throw new RegisterError(404, 'Satıcı profili bulunamadı');
  }

  if (seller.approvalStatus === 'pending') {
    throw new RegisterError(403, 'Onay beklenirken profil güncellenemez');
  }

  const criticalChanged =
    seller.approvalStatus === 'approved' &&
    hasCriticalSellerFieldChanges(seller.toObject(), data);

  const updatedSeller = await Seller.findOneAndUpdate(
    { userId: auth.userId },
    {
      $set: {
        ...data,
        ...(criticalChanged ? { approvalStatus: 'pending', rejectionReason: null } : {}),
      },
    },
    { new: true }
  );

  if (!updatedSeller) {
    throw new RegisterError(404, 'Satıcı profili bulunamadı');
  }

  if (
    updatedSeller.approvalStatus === 'draft' &&
    isSellerProfileComplete(updatedSeller.toObject())
  ) {
    updatedSeller.approvalStatus = 'pending';
    updatedSeller.rejectionReason = null;
    await updatedSeller.save();
  }

  if (
    updatedSeller.approvalStatus === 'rejected' &&
    isSellerProfileComplete(updatedSeller.toObject())
  ) {
    updatedSeller.approvalStatus = 'pending';
    updatedSeller.rejectionReason = null;
    await updatedSeller.save();
  }

  return { profile: updatedSeller, approvalStatus: updatedSeller.approvalStatus };
};
