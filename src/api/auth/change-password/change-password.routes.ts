import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/shared/middleware/auth/require-auth';
import { requireEmailVerified } from '@/shared/middleware/auth/require-email-verified';
import { validateBody } from '@/shared/middleware/validation/validate-body';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { changePassword } from '@/api/auth/change-password/change-password.service';
import { changePasswordSchema, type ChangePasswordInput } from '@/api/auth/change-password/change-password.schema';

export default async function (fastify: FastifyInstance) {
  fastify.post(
    '/',
    { preHandler: [requireAuth, requireEmailVerified, validateBody(changePasswordSchema)] },
    async (req, reply) => {
      try {
        await changePassword(req.auth!, req.body as ChangePasswordInput);

        return reply.status(200).send({
          message: 'Şifre başarıyla değiştirildi',
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Şifre değiştirilirken bir hata oluştu');
      }
    }
  );
}
