import { AuthError } from '@/domain/auth/errors';
import { isBuyerProfileComplete } from '@/domain/auth/profile/profile-completion';
import type { BuyerProfileUpdate } from '@/domain/auth/profile/profile-update.types';
import {
  findBuyerById,
  updateBuyerById,
} from '@/repositories/buyers/buyer.repository';
import { updateUserById } from '@/repositories/auth/user.repository';

const syncBuyerActiveStatus = async (userId: string, isComplete: boolean) => {
  await updateUserById(userId, { $set: { isActive: isComplete } });
  return isComplete;
};

const resolveBuyerBilling = (
  current: {
    deliveryAddress?: string | null;
    billingAddress?: string | null;
    billingSameAsDelivery?: boolean | null;
  },
  update: BuyerProfileUpdate
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

export const updateBuyerProfile = async (userId: string, data: BuyerProfileUpdate) => {
  const buyer = await findBuyerById(userId);

  if (!buyer) {
    throw new AuthError(404, 'Alıcı profili bulunamadı');
  }

  const billingUpdate = resolveBuyerBilling(buyer, data);

  const updatedBuyer = await updateBuyerById(
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
