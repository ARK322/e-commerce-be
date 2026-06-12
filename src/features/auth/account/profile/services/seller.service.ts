import { Seller } from '../../../../../db';
import { AuthError } from '../../../shared/errors';
import { isSellerProfileComplete } from '../helpers/profile-completion';
import { hasCriticalSellerFieldChanges } from '../helpers/seller-critical-fields';
import type { SellerProfileUpdateInput } from '../../../schemas/profile';

export const updateSellerProfile = async (userId: string, data: SellerProfileUpdateInput) => {
  const seller = await Seller.findOne({ userId });

  if (!seller) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  if (seller.approvalStatus === 'pending') {
    throw new AuthError(403, 'Onay beklenirken profil güncellenemez');
  }

  const criticalChanged =
    seller.approvalStatus === 'approved' &&
    hasCriticalSellerFieldChanges(seller.toObject(), data);

  const updatedSeller = await Seller.findOneAndUpdate(
    { userId },
    {
      $set: {
        ...data,
        ...(criticalChanged ? { approvalStatus: 'pending', rejectionReason: null } : {}),
      },
    },
    { returnDocument: 'after' }
  );

  if (!updatedSeller) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
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
