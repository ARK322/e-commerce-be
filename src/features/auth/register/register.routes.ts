import { FastifyInstance, FastifyReply } from 'fastify';
import { validateBody } from '../../../lib/common/middleware/validate-body';
import { baseSchema, type RegisterInput } from './schemas';
import { RegisterError, isDuplicateKeyError } from './register.errors';
import { buildAuthUserFields } from '../../../lib/auth/auth-user-response';
import { register } from './register.service';

const handleRegisterError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof RegisterError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }

  if (isDuplicateKeyError(error)) {
    return reply.status(409).send({ message: 'Bu e-posta adresi zaten kayıtlı' });
  }

  return reply.status(500).send({ message: 'Kayıt sırasında bir hata oluştu' });
};

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: validateBody(baseSchema) }, async (req, reply) => {
    try {
      const { user, token } = await register(req.body as RegisterInput);
      const statusFields = await buildAuthUserFields(user);

      return reply.status(201).send({
        message: 'Kayıt başarılı',
        ...statusFields,
        isEmailVerified: user.isEmailVerified,
        token,
      });
    } catch (error) {
      return handleRegisterError(reply, error);
    }
  });
}
