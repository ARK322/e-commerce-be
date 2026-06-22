import multipart from '@fastify/multipart';
import { FastifyInstance } from 'fastify';
import { PROFILE_DOCUMENT_MULTIPART_LIMITS } from '@/config/constants';

export const registerProfileDocumentMultipart = async (app: FastifyInstance): Promise<void> => {
  await app.register(multipart, {
    limits: {
      fileSize: PROFILE_DOCUMENT_MULTIPART_LIMITS.fileSize,
      files: PROFILE_DOCUMENT_MULTIPART_LIMITS.files,
    },
  });
};
