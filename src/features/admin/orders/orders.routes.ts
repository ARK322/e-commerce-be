import type { FastifyInstance } from 'fastify';
import { adminOnly } from '@/middleware/presets/admin-route-guards';
import { requirePermission } from '@/middleware/auth/require-admin';
import { validateParams } from '@/middleware/validation/validate-params';
import { validateQuery } from '@/middleware/validation/validate-query';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { orderIdParamSchema } from '@/shared/validation/param-schemas';
import {
  listAdminOrdersQuerySchema,
  type ListAdminOrdersQuery,
} from '@/features/admin/orders/list-orders.schema';
import { getAdminOrderById, listAdminOrders } from '@/features/admin/orders/orders.service';

export default async function adminOrdersRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.ORDERS_READ),
        validateQuery(listAdminOrdersQuerySchema),
      ],
    },
    async (req, reply) => {
      try {
        const result = await listAdminOrders(req.adminContext!, req.query as ListAdminOrdersQuery);
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Sipariş listesi alınırken bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/:orderId',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.ORDERS_READ),
        validateParams(orderIdParamSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { orderId } = req.params as { orderId: string };
        const result = await getAdminOrderById(req.adminContext!, orderId);
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Sipariş detayı alınırken bir hata oluştu');
      }
    }
  );
}
