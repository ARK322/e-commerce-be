import { FastifyInstance, FastifyReply } from 'fastify';
import { validateBody } from '../../../lib/common/middleware/validate-body';
import { RegisterError } from '../register/register.errors';
import { buildAuthUserFields } from '../../../lib/auth/auth-user-response';
import { login } from './login.service';
import { loginSchema, type LoginInput } from './schemas/login.schema';

const handleLoginError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof RegisterError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }

  return reply.status(500).send({ message: 'Giriş sırasında bir hata oluştu' });
};

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
      return handleLoginError(reply, error);
    }
  });
}
