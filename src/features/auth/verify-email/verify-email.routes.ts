import { FastifyInstance } from 'fastify';
import { validateBody } from '@/middleware/validation/validate-body';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { verifyEmail } from '@/features/auth/verify-email/verify-email.service';
import { verifyEmailSchema, type VerifyEmailInput } from '@/features/auth/verify-email/verify-email.schema';

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: validateBody(verifyEmailSchema) }, async (req, reply) => {
    try {
      const result = await verifyEmail(req.body as VerifyEmailInput);
      return reply.status(200).send(result);
    } catch (error) {
      return handleRouteError(reply, error, 'E-posta doğrulanırken bir hata oluştu');
    }
  });
}
