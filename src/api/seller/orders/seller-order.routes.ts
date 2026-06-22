import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/shared/middleware/auth/require-auth';
import { requireEmailVerified } from '@/shared/middleware/auth/require-email-verified';
import {
  requireApprovedSeller,
  requireSellerPermission,
} from '@/shared/middleware/sellers/require-approved-seller';
import { validateBody } from '@/shared/middleware/validation/validate-body';
import { validateParams } from '@/shared/middleware/validation/validate-params';
import { orderIdParamSchema } from '@/shared/validation/param-schemas';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { SELLER_PERMISSIONS } from '@/domains/identity/application/access/seller/permission-keys';
import {
  updateOrderStatusSchema,
  type UpdateOrderStatusInput,
} from '@/api/buyer/orders/update-order-status.schema';
import {
  getSellerOrderById,
  listSellerOrders,
  updateOrderStatus,
} from '@/api/buyer/orders/order.service';

const sellerApproved = {
  preHandler: [requireAuth, requireEmailVerified, requireApprovedSeller],
};

const sellerOrdersRead = {
  preHandler: [
    ...sellerApproved.preHandler,
    requireSellerPermission(SELLER_PERMISSIONS.ORDERS_READ),
  ],
};

const sellerOrdersWrite = {
  preHandler: [
    ...sellerApproved.preHandler,
    requireSellerPermission(SELLER_PERMISSIONS.ORDERS_WRITE),
  ],
};

const sellerWithOrderId = {
  preHandler: [
    ...sellerOrdersRead.preHandler,
    validateParams(orderIdParamSchema),
  ],
};

const sellerWithOrderIdWrite = {
  preHandler: [
    ...sellerOrdersWrite.preHandler,
    validateParams(orderIdParamSchema),
  ],
};

export default async function sellerOrderRoutes(fastify: FastifyInstance) {
  fastify.get('/seller', sellerOrdersRead, async (req, reply) => {
    try {
      const orders = await listSellerOrders(req.sellerContext!.companyId);
      return reply.status(200).send({ orders });
    } catch (error) {
      return handleRouteError(reply, error, 'Sipariş işlemi sırasında bir hata oluştu');
    }
  });

  fastify.get('/seller/:orderId', sellerWithOrderId, async (req, reply) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const order = await getSellerOrderById(req.sellerContext!.companyId, orderId);
      return reply.status(200).send({ order });
    } catch (error) {
      return handleRouteError(reply, error, 'Sipariş işlemi sırasında bir hata oluştu');
    }
  });

  fastify.patch(
    '/:orderId/status',
    {
      preHandler: [...sellerWithOrderIdWrite.preHandler, validateBody(updateOrderStatusSchema)],
    },
    async (req, reply) => {
      try {
        const { orderId } = req.params as { orderId: string };
        const order = await updateOrderStatus(
          req.sellerContext!.companyId,
          orderId,
          req.body as UpdateOrderStatusInput
        );

        return reply.status(200).send({
          message: 'Sipariş durumu güncellendi',
          order,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Sipariş işlemi sırasında bir hata oluştu');
      }
    }
  );
}
