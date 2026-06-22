import { FastifyInstance } from 'fastify';
import { validateBody } from '@/shared/middleware/validation/validate-body';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { forgotPassword } from '@/api/auth/forgot-password/forgot-password.service';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/api/auth/forgot-password/forgot-password.schema';

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: validateBody(forgotPasswordSchema) }, async (req, reply) => {
    try {
      await forgotPassword((req.body as ForgotPasswordInput).email);

      return reply.status(200).send({
        message: 'E-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi',
      });
    } catch (error) {
      return handleRouteError(reply, error, 'İşlem sırasında bir hata oluştu');
    }
  });
}
