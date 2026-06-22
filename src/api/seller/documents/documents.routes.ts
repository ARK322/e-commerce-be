import { FastifyInstance } from 'fastify';
import { registerProfileDocumentMultipart } from '@/shared/plugins/multipart/profile';
import { requireAuth } from '@/shared/middleware/auth/require-auth';
import { requireEmailVerified } from '@/shared/middleware/auth/require-email-verified';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { uploadSellerDocumentFromRequest } from '@/api/seller/documents/documents.service';

export default async function documentsRoutes(fastify: FastifyInstance) {
  await registerProfileDocumentMultipart(fastify);

  fastify.post(
    '/',
    { preHandler: [requireAuth, requireEmailVerified] },
    async (req, reply) => {
      try {
        const result = await uploadSellerDocumentFromRequest(req.auth!, req);

        return reply.status(200).send({
          message: 'Belge yüklendi',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Belge yüklenirken bir hata oluştu');
      }
    }
  );
}
