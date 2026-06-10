import { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuth } from '../../../lib/common/middleware/require-auth';
import { RegisterError } from '../register/register.errors';
import { getMe } from './me.service';

const handleMeError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof RegisterError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }

  return reply.status(500).send({ message: 'Kullanıcı bilgisi alınırken bir hata oluştu' });
};

export default async function (fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const result = await getMe(req.auth!);
      return reply.status(200).send(result);
    } catch (error) {
      return handleMeError(reply, error);
    }
  });
}
