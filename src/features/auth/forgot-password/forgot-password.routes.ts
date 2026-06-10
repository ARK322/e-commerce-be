import { FastifyInstance, FastifyReply } from 'fastify';
import { validateBody } from '../../../lib/common/middleware/validate-body';
import { RegisterError } from '../register/register.errors';
import { forgotPassword } from './forgot-password.service';
import { forgotPasswordSchema, type ForgotPasswordInput } from './schemas/forgot-password.schema';

const handleError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof RegisterError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }

  return reply.status(500).send({ message: 'İşlem sırasında bir hata oluştu' });
};

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: validateBody(forgotPasswordSchema) }, async (req, reply) => {
    try {
      await forgotPassword((req.body as ForgotPasswordInput).email);

      return reply.status(200).send({
        message: 'E-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi',
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
