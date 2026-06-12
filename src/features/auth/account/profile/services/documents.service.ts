import type { AuthTokenPayload } from '../../../../../lib/auth/token/access-token';
import { HttpError } from '../../../../../lib/common/errors';
import { uploadToSellerStorage } from '../../../../../lib/storage/supabase';
import { AuthError } from '../../../shared/errors';
import {
  isSellerDocumentType,
  resolveAcceptedMimeType,
  resolveDocumentExtension,
  SELLER_DOCUMENT_FIELD_MAP,
  SELLER_DOCUMENT_RULES,
  type SellerDocumentType,
} from '../helpers/seller-document-types';
import type { SellerProfileUpdateInput } from '../../../schemas/profile';
import { updateSellerProfile } from './seller.service';

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

  const extension = resolveDocumentExtension(mimeType, docType);
  const objectPath = `${auth.userId}/${docType}-${Date.now()}.${extension}`;

  let url: string;

  try {
    url = await uploadToSellerStorage(auth.userId, objectPath, input.buffer, mimeType);
  } catch (error) {
    if (error instanceof HttpError) {
      throw new AuthError(error.statusCode, error.message);
    }

    throw error;
  }

  const profileField = SELLER_DOCUMENT_FIELD_MAP[docType];
  const profileUpdate = { [profileField]: url } as SellerProfileUpdateInput;
  const result = await updateSellerProfile(auth.userId, profileUpdate);

  return {
    docType,
    url,
    field: profileField,
    approvalStatus: result.approvalStatus,
    profile: result.profile,
  };
};
