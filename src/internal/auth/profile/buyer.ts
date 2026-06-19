import { User, Buyer } from '@/integrations/mongo';
import { AuthError } from '@/internal/auth/errors';
import { isBuyerProfileComplete } from '@/internal/auth/profile/profile-completion';
import type { BuyerProfileUpdateInput } from '@/features/auth/account/profile/profile.schema';

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

export const updateBuyerProfile = async (userId: string, data: BuyerProfileUpdateInput) => {
  const buyer = await Buyer.findById(userId);

  if (!buyer) {
    throw new AuthError(404, 'Alıcı profili bulunamadı');
  }

  const billingUpdate = resolveBuyerBilling(buyer, data);

  const updatedBuyer = await Buyer.findByIdAndUpdate(
    userId,
    { $set: { ...data, ...billingUpdate } },
    { returnDocument: 'after' }
  );

  if (!updatedBuyer) {
    throw new AuthError(404, 'Alıcı profili bulunamadı');
  }

  const isActive = await syncBuyerActiveStatus(
    userId,
    isBuyerProfileComplete(updatedBuyer.toObject())
  );

  return { profile: updatedBuyer.toObject(), isActive };
};
