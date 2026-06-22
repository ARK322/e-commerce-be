import { FastifyInstance } from 'fastify';
import { validateBody } from '@/shared/middleware/validation/validate-body';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { resetPassword } from '@/api/auth/reset-password/reset-password.service';
import { resetPasswordSchema, type ResetPasswordInput } from '@/api/auth/reset-password/reset-password.schema';

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: validateBody(resetPasswordSchema) }, async (req, reply) => {
    try {
      await resetPassword(req.body as ResetPasswordInput);

      return reply.status(200).send({
        message: 'Şifre başarıyla sıfırlandı',
      });
    } catch (error) {
      return handleRouteError(reply, error, 'Şifre sıfırlanırken bir hata oluştu');
    }
  });
}
