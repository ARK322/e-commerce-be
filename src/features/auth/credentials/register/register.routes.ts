import { FastifyInstance } from 'fastify';
import { validateBody } from '@/middleware/validation/validate-body';
import { handleRouteError } from '@/internal/errors/handle-route-error';
import { buildAuthUserFields } from '@/internal/auth/responses/user.response';
import { registerSchema, type RegisterInput } from '@/features/auth/credentials/register/register.schema';
import { register } from '@/features/auth/credentials/register/register.service';

export default async function (fastify: FastifyInstance) {
  fastify.post('/', { preHandler: validateBody(registerSchema) }, async (req, reply) => {
    try {
      const { user } = await register(req.body as RegisterInput);
      const statusFields = await buildAuthUserFields(user);

      return reply.status(201).send({
        message: 'Kayıt başarılı. E-posta adresini doğrula.',
        ...statusFields,
        isEmailVerified: user.isEmailVerified,
      });
    } catch (error) {
      return handleRouteError(reply, error, 'Kayıt sırasında bir hata oluştu', {
        duplicateKeyMessage: 'Bu e-posta adresi zaten kayıtlı',
      });
    }
  });
}
