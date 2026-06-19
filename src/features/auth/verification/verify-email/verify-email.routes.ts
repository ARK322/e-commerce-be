import { FastifyInstance } from 'fastify';
import { validateBody } from '@/middleware/validation/validate-body';
import { handleRouteError } from '@/internal/errors/handle-route-error';
import { buildAuthUserFields } from '@/internal/auth/responses/user.response';
import { verifyEmail } from '@/features/auth/verification/verify-email/verify-email.service';
import { verifyEmailSchema, type VerifyEmailInput } from '@/features/auth/verification/verify-email/verify-email.schema';

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: validateBody(verifyEmailSchema) }, async (req, reply) => {
    try {
      const { user, token } = await verifyEmail(req.body as VerifyEmailInput);
      const statusFields = await buildAuthUserFields(user);

      return reply.status(200).send({
        message: 'E-posta doğrulandı',
        ...statusFields,
        isEmailVerified: user.isEmailVerified,
        token,
      });
    } catch (error) {
      return handleRouteError(reply, error, 'E-posta doğrulanırken bir hata oluştu');
    }
  });
}
