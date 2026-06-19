import { FastifyInstance } from 'fastify';
import { validateBody } from '@/middleware/validation/validate-body';
import { handleRouteError } from '@/internal/errors/handle-route-error';
import { buildAuthUserFields } from '@/internal/auth/responses/user.response';
import { login } from '@/features/auth/credentials/login/login.service';
import { loginSchema, type LoginInput } from '@/features/auth/credentials/login/login.schema';

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: validateBody(loginSchema) }, async (req, reply) => {
    try {
      const { user, token } = await login(req.body as LoginInput);
      const statusFields = await buildAuthUserFields(user);

      return reply.status(200).send({
        message: 'Giriş başarılı',
        ...statusFields,
        token,
      });
    } catch (error) {
      return handleRouteError(reply, error, 'Giriş sırasında bir hata oluştu');
    }
  });
}
