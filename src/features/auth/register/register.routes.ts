import { FastifyInstance } from 'fastify';
import { validateBody } from '@/middleware/validation/validate-body';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { registerSchema, type RegisterInput } from '@/features/auth/register/register.schema';
import { REGISTER_ACK_MESSAGE } from '@/domain/auth/register/register-response';
import { register } from '@/features/auth/register/register.service';

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: validateBody(registerSchema) }, async (req, reply) => {
    try {
      const result = await register(req.body as RegisterInput);
      return reply.status(201).send(result);
    } catch (error) {
      return handleRouteError(reply, error, 'Kayıt sırasında bir hata oluştu', {
        duplicateKeyMessage: REGISTER_ACK_MESSAGE,
        duplicateKeyStatusCode: 201,
      });
    }
  });
}
