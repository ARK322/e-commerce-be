import type { FastifyRequest } from 'fastify';
import type { AuthTokenPayload } from '@/domain/auth/tokens/access-token';
import { AuthError } from '@/domain/auth/errors';
import { uploadSellerDocument } from '@/domain/auth/profile/documents';

export const uploadSellerDocumentFromRequest = async (
  auth: AuthTokenPayload,
  request: FastifyRequest
) => {
  const file = await request.file();

  if (!file) {
    throw new AuthError(400, 'Dosya zorunlu');
  }

  const docTypeField = file.fields.docType;

  if (!docTypeField || Array.isArray(docTypeField) || docTypeField.type !== 'field') {
    throw new AuthError(400, 'docType zorunlu');
  }

  const buffer = await file.toBuffer();

  return uploadSellerDocument(auth, {
    docType: String(docTypeField.value),
    mimeType: file.mimetype,
    buffer,
  });
};
