import { Buyer } from '@/integrations/mongo';
import { findUserByIdLean } from '@/repositories/auth/user.repository';

export const findBuyerShippingProfileLean = async (buyerId: string) =>
  Buyer.findById(buyerId).lean();

export const findBuyerByIdLean = async (buyerId: string) => Buyer.findById(buyerId).lean();

export const createBuyerProfile = async (buyerId: string) => Buyer.create({ _id: buyerId });

export const findBuyerPaymentProfileLean = async (buyerId: string) => {
  const [user, buyer] = await Promise.all([
    findUserByIdLean(buyerId),
    findBuyerByIdLean(buyerId),
  ]);

  return { user, buyer };
};
