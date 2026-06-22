import multipart from '@fastify/multipart';
import { FastifyInstance } from 'fastify';
import { PRODUCT_MULTIPART_LIMITS } from '@/config/constants';

export const registerProductMultipart = async (app: FastifyInstance): Promise<void> => {
  await app.register(multipart, {
    limits: {
      fileSize: PRODUCT_MULTIPART_LIMITS.fileSize,
      files: PRODUCT_MULTIPART_LIMITS.files,
    },
  });
};
