import { FastifyInstance } from 'fastify';
import { adminOnly } from '@/middleware/presets/admin-route-guards';
import { requireOwner } from '@/middleware/auth/require-admin';
import { validateBody } from '@/middleware/validation/validate-body';
import { validateParams } from '@/middleware/validation/validate-params';
import { userIdParamSchema } from '@/internal/validation/param-schemas';
import { handleRouteError } from '@/internal/errors/handle-route-error';
import { createAdmin, deleteAdmin, getAdminByUserId, listAdmins, updateAdmin } from '@/features/auth/admin/admins/admins.service';
import { createAdminSchema, type CreateAdminInput } from '@/features/auth/admin/admins/create-admin.schema';
import { updateAdminSchema, type UpdateAdminInput } from '@/features/auth/admin/admins/update-admin.schema';

const adminWithUserId = {
  preHandler: [...adminOnly.preHandler, validateParams(userIdParamSchema)],
};

export default async function (fastify: FastifyInstance) {
  fastify.get('/', adminOnly, async (req, reply) => {
    try {
      if (!req.adminContext) {
        return reply.status(403).send({ message: 'Admin profili bulunamadı' });
      }

      const admins = await listAdmins(req.adminContext);
      return reply.status(200).send({ admins });
    } catch (error) {
      return handleRouteError(reply, error, 'Admin işlemi sırasında bir hata oluştu');
    }
  });

  fastify.get('/:userId', adminWithUserId, async (req, reply) => {
    try {
      if (!req.adminContext) {
        return reply.status(403).send({ message: 'Admin profili bulunamadı' });
      }

      const { userId } = req.params as { userId: string };
      const admin = await getAdminByUserId(req.adminContext, req.auth!.userId, userId);

      return reply.status(200).send(admin);
    } catch (error) {
      return handleRouteError(reply, error, 'Admin işlemi sırasında bir hata oluştu');
    }
  });

  fastify.post(
    '/',
    { preHandler: [...adminOnly.preHandler, requireOwner, validateBody(createAdminSchema)] },
    async (req, reply) => {
      try {
        if (!req.adminContext) {
          return reply.status(403).send({ message: 'Admin profili bulunamadı' });
        }

        const result = await createAdmin(req.adminContext, req.body as CreateAdminInput);

        return reply.status(201).send({
          message: 'Admin oluşturuldu',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Admin işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.patch(
    '/:userId',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requireOwner,
        validateParams(userIdParamSchema),
        validateBody(updateAdminSchema),
      ],
    },
    async (req, reply) => {
      try {
        if (!req.adminContext) {
          return reply.status(403).send({ message: 'Admin profili bulunamadı' });
        }

        const { userId } = req.params as { userId: string };
        const result = await updateAdmin(
          req.adminContext,
          req.auth!.userId,
          userId,
          req.body as UpdateAdminInput
        );

        return reply.status(200).send({
          message: 'Admin güncellendi',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Admin işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.delete(
    '/:userId',
    {
      preHandler: [...adminOnly.preHandler, requireOwner, validateParams(userIdParamSchema)],
    },
    async (req, reply) => {
      try {
        if (!req.adminContext) {
          return reply.status(403).send({ message: 'Admin profili bulunamadı' });
        }

        const { userId } = req.params as { userId: string };
        const result = await deleteAdmin(req.adminContext, userId);

        return reply.status(200).send({
          message: 'Admin silindi',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Admin işlemi sırasında bir hata oluştu');
      }
    }
  );
}
