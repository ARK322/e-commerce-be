import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/middleware/auth/require-auth';
import { requireEmailVerified } from '@/middleware/auth/require-email-verified';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { getMe } from '@/features/auth/me/me.service';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [requireAuth, requireEmailVerified] }, async (req, reply) => {
    try {
      const result = await getMe(req.auth!);
      return reply.status(200).send(result);
    } catch (error) {
      return handleRouteError(reply, error, 'Kullanıcı bilgisi alınırken bir hata oluştu');
    }
  });
}
