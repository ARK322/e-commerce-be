import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/shared/middleware/auth/require-auth';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { logout, logoutAllSessions } from '@/api/auth/logout/logout.service';

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: requireAuth }, async (req, reply) => {
    try {
      await logout(req.authToken!);

      return reply.status(200).send({
        message: 'Çıkış başarılı',
      });
    } catch (error) {
      return handleRouteError(reply, error, 'Çıkış sırasında bir hata oluştu');
    }
  });

  fastify.post('/all', { preHandler: requireAuth }, async (req, reply) => {
    try {
      await logoutAllSessions(req.auth!.userId);

      return reply.status(200).send({
        message: 'Tüm oturumlar sonlandırıldı',
      });
    } catch (error) {
      return handleRouteError(reply, error, 'Çıkış sırasında bir hata oluştu');
    }
  });
}
