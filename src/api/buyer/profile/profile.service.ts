import type { AuthTokenPayload } from '@/domains/identity/application/tokens/access-token';
import { AuthError } from '@/domains/identity/application/errors';
import { buildAuthUserFields } from '@/domains/identity/application/responses/user.response';
import { updateBuyerProfile } from '@/domains/identity/application/profile/buyer';
import { updateSellerProfile } from '@/domains/identity/application/profile/seller';
import { findUserById } from '@/domains/identity/infrastructure/repositories/auth/user.repository';
import { findBuyerByIdLean } from '@/domains/identity/infrastructure/repositories/buyer.repository';
import { findSellerByIdLean } from '@/domains/identity/infrastructure/repositories/seller.repository';
import type { BuyerProfileUpdateInput, SellerProfileUpdateInput } from '@/api/buyer/profile/profile.schema';

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
