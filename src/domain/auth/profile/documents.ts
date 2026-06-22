import type { AuthTokenPayload } from '@/domain/auth/tokens/access-token';
import { HttpError } from '@/shared/errors';
import {
  deleteFromSellerStorage,
  getSupabaseConfig,
  parseStorageObjectPathFromPublicUrl,
  uploadToSellerStorage,
} from '@/infrastructure/supabase/supabase';
import { getSellerContext } from '@/domain/auth/queries/seller-context';
import { AuthError } from '@/domain/auth/errors';
import {
  buildSellerDocumentObjectPath,
  isSellerDocumentType,
  resolveAcceptedMimeType,
  resolveDocumentExtension,
  SELLER_DOCUMENT_FIELD_MAP,
  SELLER_DOCUMENT_RULES,
  type SellerDocumentType,
} from '@/domain/auth/profile/seller-document-types';
import type { SellerProfileUpdate } from '@/domain/auth/profile/profile-update.types';
import { updateSellerProfile } from '@/domain/auth/profile/seller';
import {
  findSellerByIdLean,
  updateSellerById,
} from '@/repositories/sellers/seller.repository';

export type UploadSellerDocumentInput = {
  docType: string;
  mimeType: string;
  buffer: Buffer;
};

export const uploadSellerDocument = async (
  auth: AuthTokenPayload,
  input: UploadSellerDocumentInput
) => {
  if (auth.role !== 'seller') {
    throw new AuthError(403, 'Bu endpoint sadece satıcılar içindir');
  }

  if (!isSellerDocumentType(input.docType)) {
    throw new AuthError(400, 'Geçersiz belge tipi');
  }

  const docType: SellerDocumentType = input.docType;
  const rules = SELLER_DOCUMENT_RULES[docType];
  const mimeType = resolveAcceptedMimeType(docType, input.mimeType, input.buffer);

  if (!mimeType) {
    throw new AuthError(400, 'Geçersiz dosya türü');
  }

  if (input.buffer.length === 0) {
    throw new AuthError(400, 'Dosya boş olamaz');
  }

  if (input.buffer.length > rules.maxBytes) {
    throw new AuthError(400, 'Dosya boyutu limiti aşıldı');
  }

  const ctx = await getSellerContext(auth.userId);

  if (!ctx) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  if (!ctx.isOwner) {
    throw new AuthError(403, 'Belge yükleme sadece şirket sahibi tarafından yapılabilir');
  }

  const seller = await findSellerByIdLean(ctx.companyId);

  if (!seller) {
    throw new AuthError(404, 'Satıcı profili bulunamadı');
  }

  const extension = resolveDocumentExtension(mimeType, docType);
  const objectPath = buildSellerDocumentObjectPath(ctx.companyId, docType, extension);
  const profileField = SELLER_DOCUMENT_FIELD_MAP[docType];
  const oldUrl = seller[profileField as keyof typeof seller];

  if (typeof oldUrl === 'string' && oldUrl.trim()) {
    const { bucket } = getSupabaseConfig();
    const oldObjectPath = parseStorageObjectPathFromPublicUrl(oldUrl, bucket);

    if (oldObjectPath && oldObjectPath !== objectPath) {
      await deleteFromSellerStorage(oldObjectPath);
    }
  }

  let url: string;

  try {
    url = await uploadToSellerStorage(objectPath, input.buffer, mimeType);
  } catch (error) {
    if (error instanceof HttpError) {
      throw new AuthError(error.statusCode, error.message);
    }

    throw error;
  }

  const profileUpdate = { [profileField]: url } as SellerProfileUpdate;

  if (seller.approvalStatus === 'pending') {
    await updateSellerById(ctx.companyId, { $set: profileUpdate });
    const refreshed = await findSellerByIdLean(ctx.companyId);

    return {
      docType,
      url,
      field: profileField,
      approvalStatus: refreshed?.approvalStatus ?? 'pending',
      profile: refreshed,
    };
  }

  const result = await updateSellerProfile(auth.userId, profileUpdate);

  return {
    docType,
    url,
    field: profileField,
    approvalStatus: result.approvalStatus,
    profile: result.profile,
  };
};
