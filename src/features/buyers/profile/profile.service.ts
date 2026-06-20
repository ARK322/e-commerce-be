import type { AuthTokenPayload } from '@/internal/auth/tokens/access-token';
import { AuthError } from '@/internal/auth/errors';
import { buildAuthUserFields } from '@/internal/auth/responses/user.response';
import { updateBuyerProfile } from '@/internal/auth/profile/buyer';
import { updateSellerProfile } from '@/internal/auth/profile/seller';
import { findUserById } from '@/repositories/auth/user.repository';
import { findBuyerByIdLean } from '@/repositories/buyers/buyer.repository';
import { findSellerByIdLean } from '@/repositories/sellers/seller.repository';
import type { BuyerProfileUpdateInput, SellerProfileUpdateInput } from '@/features/buyers/profile/profile.schema';

export const getProfile = async (auth: AuthTokenPayload) => {
  const user = await findUserById(auth.userId);

  if (!user) {
    throw new AuthError(404, 'Kullanıcı bulunamadı');
  }

  if (auth.role === 'admin' || user.role === 'admin') {
    throw new AuthError(403, 'Bu endpoint buyer ve seller içindir');
  }

  const statusFields = await buildAuthUserFields(user);

  if (auth.role === 'buyer') {
    const profile = await findBuyerByIdLean(auth.userId);

    if (!profile) {
      throw new AuthError(404, 'Alıcı profili bulunamadı');
    }

    return {
      email: user.email,
      ...statusFields,
      profile,
    };
  }

  if (auth.role === 'seller') {
    const profile = await findSellerByIdLean(
      'companyId' in statusFields ? String(statusFields.companyId) : auth.userId
    );

    if (!profile) {
      throw new AuthError(404, 'Satıcı profili bulunamadı');
    }

    return {
      email: user.email,
      ...statusFields,
      rejectionReason: profile.rejectionReason ?? null,
      profile,
    };
  }

  throw new AuthError(403, 'Bu endpoint buyer ve seller içindir');
};

export const updateProfile = async (
  auth: AuthTokenPayload,
  data: BuyerProfileUpdateInput | SellerProfileUpdateInput
) => {
  if (auth.role === 'buyer') {
    return updateBuyerProfile(auth.userId, data as BuyerProfileUpdateInput);
  }

  if (auth.role === 'seller') {
    return updateSellerProfile(auth.userId, data as SellerProfileUpdateInput);
  }

  throw new AuthError(403, 'Bu endpoint buyer ve seller içindir');
};
