import { FastifyInstance } from 'fastify';
import { validateBody } from '@/shared/middleware/validation/validate-body';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { login } from '@/api/auth/login/login.service';
import { loginSchema, type LoginInput } from '@/api/auth/login/login.schema';

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: validateBody(loginSchema) }, async (req, reply) => {
    try {
      const result = await login(req.body as LoginInput);
      return reply.status(200).send(result);
    } catch (error) {
      return handleRouteError(reply, error, 'Giriş sırasında bir hata oluştu');
    }
  });
}
