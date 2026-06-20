import { Seller, type SellerApprovalStatus } from '@/integrations/mongo';

export const findSellerById = async (sellerId: string) => Seller.findById(sellerId);

export const findSellerByIdLean = async (sellerId: string) => Seller.findById(sellerId).lean();

export const listSellersLean = async (filter: { approvalStatus?: SellerApprovalStatus } = {}) =>
  Seller.find(filter).sort({ _id: -1 }).lean();

export const createSellerProfile = async (sellerId: string) => Seller.create({ _id: sellerId });

export const saveSellerDocument = async (seller: { save: () => Promise<unknown> }) => seller.save();

export const approveSellerIfPending = async (
  sellerId: string,
  data: {
    approvalStatus: 'approved';
    rejectionReason: null;
    iyzicoSubMerchantKey: string;
  }
) =>
  Seller.findOneAndUpdate(
    { _id: sellerId, approvalStatus: 'pending' },
    { $set: data },
    { returnDocument: 'after' }
  );
