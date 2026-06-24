import { FastifyInstance } from 'fastify';
import { adminOnly } from '@/middleware/presets/admin-route-guards';
import { requirePermission } from '@/middleware/auth/require-admin';
import { validateParams } from '@/middleware/validation/validate-params';
import { validateQuery } from '@/middleware/validation/validate-query';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { userIdParamSchema } from '@/shared/validation/param-schemas';
import {
  listBuyersQuerySchema,
  type ListBuyersQuery,
} from '@/features/admin/buyers/list-buyers.schema';
import { getBuyerById, listBuyers } from '@/features/admin/buyers/buyers.service';

const adminWithUserId = {
  preHandler: [...adminOnly.preHandler, validateParams(userIdParamSchema)],
};

export default async function adminBuyersRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.BUYERS_READ),
        validateQuery(listBuyersQuerySchema),
      ],
    },
    async (req, reply) => {
      try {
        const result = await listBuyers(req.adminContext!, req.query as ListBuyersQuery);
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Alıcı listesi alınırken bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/:userId',
    {
      preHandler: [...adminWithUserId.preHandler, requirePermission(PERMISSIONS.BUYERS_READ)],
    },
    async (req, reply) => {
      try {
        const { userId } = req.params as { userId: string };
        const result = await getBuyerById(req.adminContext!, userId);
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Alıcı detayı alınırken bir hata oluştu');
      }
    }
  );
}
