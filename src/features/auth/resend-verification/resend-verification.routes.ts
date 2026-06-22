import { FastifyInstance } from 'fastify';
import { validateBody } from '@/middleware/validation/validate-body';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { resendVerificationEmail } from '@/features/auth/resend-verification/resend-verification.service';
import {
  resendVerificationSchema,
  type ResendVerificationInput,
} from '@/features/auth/resend-verification/resend-verification.schema';

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: validateBody(resendVerificationSchema) }, async (req, reply) => {
    try {
      await resendVerificationEmail((req.body as ResendVerificationInput).email);

      return reply.status(200).send({
        message: 'E-posta kayıtlı ve doğrulanmamışsa doğrulama maili gönderildi',
      });
    } catch (error) {
      return handleRouteError(reply, error, 'E-posta gönderilirken bir hata oluştu');
    }
  });
}
