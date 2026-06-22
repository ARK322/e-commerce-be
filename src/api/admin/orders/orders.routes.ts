import type { FastifyInstance } from 'fastify';
import { adminOnly } from '@/shared/middleware/presets/admin-route-guards';
import { requirePermission } from '@/shared/middleware/auth/require-admin';
import { validateParams } from '@/shared/middleware/validation/validate-params';
import { validateQuery } from '@/shared/middleware/validation/validate-query';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import { orderIdParamSchema } from '@/shared/validation/param-schemas';
import {
  listAdminOrdersQuerySchema,
  type ListAdminOrdersQuery,
} from '@/api/admin/orders/list-orders.schema';
import { getAdminOrderById, listAdminOrders } from '@/api/admin/orders/orders.service';

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
