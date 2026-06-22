import { Buyer } from '@/infrastructure/mongo';
import { findUserByIdLean } from '@/repositories/auth/user.repository';

export const findBuyerShippingProfileLean = async (buyerId: string) =>
  Buyer.findById(buyerId).lean();

export const findBuyerById = async (buyerId: string) => Buyer.findById(buyerId);

export const findBuyerByIdLean = async (buyerId: string) => Buyer.findById(buyerId).lean();

export const updateBuyerById = async (
  buyerId: string,
  update: Record<string, unknown>,
  options?: { returnDocument?: 'after' | 'before' }
) => Buyer.findByIdAndUpdate(buyerId, update, options);

export const deleteBuyerById = async (buyerId: string) => Buyer.findByIdAndDelete(buyerId);

export const createBuyerProfile = async (buyerId: string) => Buyer.create({ _id: buyerId });

export const findBuyerPaymentProfileLean = async (buyerId: string) => {
  const [user, buyer] = await Promise.all([
    findUserByIdLean(buyerId),
    findBuyerByIdLean(buyerId),
  ]);

  return { user, buyer };
};
