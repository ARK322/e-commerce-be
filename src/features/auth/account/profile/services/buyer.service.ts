import { User, Buyer } from '../../../../../db';
import { AuthError } from '../../../shared/errors';
import { isBuyerProfileComplete } from '../helpers/profile-completion';
import type { BuyerProfileUpdateInput } from '../../../schemas/profile';

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
  const buyer = await Buyer.findOne({ userId });

  if (!buyer) {
    throw new AuthError(404, 'Alıcı profili bulunamadı');
  }

  const billingUpdate = resolveBuyerBilling(buyer, data);

  const updatedBuyer = await Buyer.findOneAndUpdate(
    { userId },
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

  return { profile: updatedBuyer, isActive };
};
