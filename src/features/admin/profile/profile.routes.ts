import { FastifyInstance } from 'fastify';
import { adminOnly } from '@/middleware/presets/admin-route-guards';
import { validateBody } from '@/middleware/validation/validate-body';
import { validateParams } from '@/middleware/validation/validate-params';
import { userIdParamSchema } from '@/shared/validation/param-schemas';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import {
  adminProfileUpdateSchema,
  type AdminProfileUpdateInput,
} from '@/features/admin/profile/profile.schema';
import { getAdminProfile, updateAdminProfile } from '@/features/admin/profile/profile.service';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', adminOnly, async (req, reply) => {
    try {
      if (!req.adminContext) {
        return reply.status(403).send({ message: 'Admin profili bulunamadı' });
      }

      const profile = await getAdminProfile(req.adminContext);
      return reply.status(200).send(profile);
    } catch (error) {
      return handleRouteError(reply, error, 'Admin profil işlemi sırasında bir hata oluştu');
    }
  });

  fastify.patch(
    '/',
    { preHandler: [...adminOnly.preHandler, validateBody(adminProfileUpdateSchema)] },
    async (req, reply) => {
      try {
        if (!req.adminContext) {
          return reply.status(403).send({ message: 'Admin profili bulunamadı' });
        }

        const profile = await updateAdminProfile(
          req.adminContext,
          req.auth!.userId,
          req.auth!.userId,
          req.body as AdminProfileUpdateInput
        );

        return reply.status(200).send({
          message: 'Profil güncellendi',
          ...profile,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Admin profil işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.patch(
    '/:userId',
    {
      preHandler: [
        ...adminOnly.preHandler,
        validateParams(userIdParamSchema),
        validateBody(adminProfileUpdateSchema),
      ],
    },
    async (req, reply) => {
      try {
        if (!req.adminContext) {
          return reply.status(403).send({ message: 'Admin profili bulunamadı' });
        }

        const { userId } = req.params as { userId: string };
        const profile = await updateAdminProfile(
          req.adminContext,
          req.auth!.userId,
          userId,
          req.body as AdminProfileUpdateInput
        );

        return reply.status(200).send({
          message: 'Admin profili güncellendi',
          ...profile,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Admin profil işlemi sırasında bir hata oluştu');
      }
    }
  );
}
