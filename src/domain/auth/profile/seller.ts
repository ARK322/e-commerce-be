import { canReadCompanyProfile, canWriteCompanyProfile } from '@/domain/auth/access/seller/permissions';
import { getSellerContext, type SellerAccessContext } from '@/domain/auth/queries/seller-context';
import {
  bootstrapSellerTeam,
  cleanupSellerTeam,
} from '@/domain/auth/access/seller/system-roles';
import { AuthError } from '@/domain/auth/errors';
import { isSellerProfileComplete } from '@/domain/auth/profile/profile-completion';
import { hasCriticalSellerFieldChanges } from '@/domain/auth/profile/seller-critical-fields';
import {
  assertIbanUpdateAllowed,
  omitUnchangedLockedIban,
} from '@/domain/auth/profile/seller-iban-lock';
import type { SellerProfileUpdate } from '@/domain/auth/profile/profile-update.types';
import {
  findSellerById,
  findSellerByIdLean,
  saveSellerDocument,
  updateSellerById,
} from '@/repositories/sellers/seller.repository';

const assertCanReadCompany = (ctx: SellerAccessContext) => {
  if (!canReadCompanyProfile(ctx)) {
    throw new AuthError(403, 'Şirket profilini görüntüleme yetkin yok');
  }
};

const assertCanWriteCompany = (ctx: SellerAccessContext) => {
  if (!canWriteCompanyProfile(ctx)) {
    throw new AuthError(403, 'Şirket profilini güncelleme yetkin yok');
  }
};

export const updateSellerProfile = async (userId: string, data: SellerProfileUpdate) => {
  const ctx = await getSellerContext(userId);

  if (!ctx) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  assertCanWriteCompany(ctx);

  const seller = await findSellerById(ctx.companyId);

  if (!seller) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  if (seller.approvalStatus === 'pending') {
    throw new AuthError(403, 'Onay beklenirken profil güncellenemez');
  }

  assertIbanUpdateAllowed(seller.iban, data.iban);

  const updateData = omitUnchangedLockedIban(
    seller.iban,
    data as Record<string, unknown>
  ) as SellerProfileUpdate;

  const criticalChanged =
    ctx.teamManagementEnabled &&
    !ctx.isOwner &&
    seller.approvalStatus === 'approved' &&
    hasCriticalSellerFieldChanges(seller.toObject(), updateData);

  if (criticalChanged) {
    throw new AuthError(403, 'Kritik şirket bilgilerini sadece şirket sahibi güncelleyebilir');
  }

  const ownerCriticalChanged =
    ctx.isOwner &&
    seller.approvalStatus === 'approved' &&
    hasCriticalSellerFieldChanges(seller.toObject(), updateData);

  const previousSellerType = seller.sellerType;

  const updatedSeller = await updateSellerById(
    ctx.companyId,
    {
      $set: {
        ...updateData,
        ...(ownerCriticalChanged ? { approvalStatus: 'pending', rejectionReason: null } : {}),
      },
    },
    { returnDocument: 'after' }
  );

  if (!updatedSeller) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  if (updateData.sellerType === 'kurumsal' && previousSellerType !== 'kurumsal') {
    await bootstrapSellerTeam(ctx.companyId, userId);
  }

  if (updateData.sellerType === 'bireysel' && previousSellerType === 'kurumsal') {
    await cleanupSellerTeam(ctx.companyId);
  }

  if (
    updatedSeller.approvalStatus === 'draft' &&
    isSellerProfileComplete(updatedSeller.toObject())
  ) {
    updatedSeller.approvalStatus = 'pending';
    updatedSeller.rejectionReason = null;
    await saveSellerDocument(updatedSeller);
  }

  if (
    updatedSeller.approvalStatus === 'rejected' &&
    isSellerProfileComplete(updatedSeller.toObject())
  ) {
    updatedSeller.approvalStatus = 'pending';
    updatedSeller.rejectionReason = null;
    await saveSellerDocument(updatedSeller);
  }

  return {
    profile: updatedSeller.toObject(),
    approvalStatus: updatedSeller.approvalStatus,
  };
};

export const getSellerCompanyProfile = async (userId: string) => {
  const ctx = await getSellerContext(userId);

  if (!ctx) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  assertCanReadCompany(ctx);

  const profile = await findSellerByIdLean(ctx.companyId);

  if (!profile) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  return profile;
};
