import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/middleware/auth/require-auth';
import { requireEmailVerified } from '@/middleware/auth/require-email-verified';
import { handleRouteError } from '@/internal/errors/handle-route-error';
import { uploadSellerDocument } from '@/internal/auth/profile/documents';

export default async function documentsRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    { preHandler: [requireAuth, requireEmailVerified] },
    async (req, reply) => {
      try {
        const file = await req.file();

        if (!file) {
          return reply.status(400).send({ message: 'Dosya zorunlu' });
        }

        const docTypeField = file.fields.docType;

        if (!docTypeField || Array.isArray(docTypeField) || docTypeField.type !== 'field') {
          return reply.status(400).send({ message: 'docType zorunlu' });
        }

        const docType = String(docTypeField.value);
        const buffer = await file.toBuffer();

        const result = await uploadSellerDocument(req.auth!, {
          docType,
          mimeType: file.mimetype,
          buffer,
        });

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
