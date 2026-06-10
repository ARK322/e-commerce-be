import { Seller } from '../../db';
import type { SellerApprovalStatus } from '../../db/auth/seller.model';

export const getSellerApprovalStatus = async (
  userId: string
): Promise<SellerApprovalStatus> => {
  const seller = await Seller.findOne({ userId }).select('approvalStatus').lean();

  return seller?.approvalStatus ?? 'draft';
};
