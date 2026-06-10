import { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuth } from '../../../lib/common/middleware/require-auth';
import { RegisterError } from '../register/register.errors';
import { logout } from './logout.service';

const handleLogoutError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof RegisterError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }

  return reply.status(500).send({ message: 'Çıkış sırasında bir hata oluştu' });
};

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: requireAuth }, async (req, reply) => {
    try {
      await logout(req.authToken!);

      return reply.status(200).send({
        message: 'Çıkış başarılı',
      });
    } catch (error) {
      return handleLogoutError(reply, error);
    }
  });
}
