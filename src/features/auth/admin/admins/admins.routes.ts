import { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuth } from '../../../../lib/common/middleware/require-auth';
import { requireAdmin } from '../../../../lib/auth/middleware/require-admin';
import { requireOwner } from '../../../../lib/auth/middleware/require-owner';
import { validateBody } from '../../../../lib/common/middleware/validate-body';
import { validateParams } from '../../../../lib/common/middleware/validate-params';
import { userIdParamSchema } from '../../../../lib/common/validation/param-schemas';
import { RegisterError } from '../../register/register.errors';
import { createAdmin, deleteAdmin, listAdmins } from './admins.service';
import { createAdminSchema, type CreateAdminInput } from './schemas/create-admin.schema';

const handleAdminManageError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof RegisterError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }

  return reply.status(500).send({ message: 'Admin işlemi sırasında bir hata oluştu' });
};

export default async function (fastify: FastifyInstance) {
  const adminOnly = { preHandler: [requireAuth, requireAdmin] };

  fastify.get('/', adminOnly, async (_req, reply) => {
    try {
      const admins = await listAdmins();
      return reply.status(200).send({ admins });
    } catch (error) {
      return handleAdminManageError(reply, error);
    }
  });

  fastify.post(
    '/',
    { preHandler: [requireAuth, requireAdmin, validateBody(createAdminSchema)] },
    async (req, reply) => {
      try {
        if (!req.adminRole) {
          return reply.status(403).send({ message: 'Admin profili bulunamadı' });
        }

        const result = await createAdmin(
          req.auth!.userId,
          req.adminRole,
          req.body as CreateAdminInput
        );

        return reply.status(201).send({
          message: 'Admin oluşturuldu',
          ...result,
        });
      } catch (error) {
        return handleAdminManageError(reply, error);
      }
    }
  );

  fastify.delete(
    '/:userId',
    {
      preHandler: [requireAuth, requireAdmin, requireOwner, validateParams(userIdParamSchema)],
    },
    async (req, reply) => {
      try {
        if (!req.adminRole) {
          return reply.status(403).send({ message: 'Admin profili bulunamadı' });
        }

        const { userId } = req.params as { userId: string };
        const result = await deleteAdmin(req.adminRole, userId);

        return reply.status(200).send({
          message: 'Admin silindi',
          ...result,
        });
      } catch (error) {
        return handleAdminManageError(reply, error);
      }
    }
  );
}
