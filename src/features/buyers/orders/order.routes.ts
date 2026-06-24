import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/middleware/auth/require-auth';
import { requireEmailVerified } from '@/middleware/auth/require-email-verified';
import {
  requireApprovedSeller,
  requireSellerPermission,
} from '@/middleware/sellers/require-approved-seller';
import { validateBody } from '@/middleware/validation/validate-body';
import { validateParams } from '@/middleware/validation/validate-params';
import { orderIdParamSchema } from '@/shared/validation/param-schemas';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { SELLER_PERMISSIONS } from '@/domain/auth/access/seller/permission-keys';
import { buyerOnly, buyerWithParams } from '@/middleware/presets/buyer-route-guards';
import { createOrderSchema, type CreateOrderInput } from '@/features/buyers/orders/create-order.schema';
import {
  updateOrderStatusSchema,
  type UpdateOrderStatusInput,
} from '@/features/buyers/orders/update-order-status.schema';
import {
  createReturnRequestSchema,
  type CreateReturnRequestBody,
} from '@/features/buyers/orders/create-return-request.schema';
import {
  createShipmentSchema,
  type CreateShipmentInput,
} from '@/features/buyers/orders/create-shipment.schema';
import {
  orderItemParamsSchema,
  updateOrderItemStatusSchema,
  type UpdateOrderItemStatusInput,
} from '@/features/buyers/orders/update-order-item-status.schema';
import {
  cancelBuyerPendingOrder,
  createOrderFromCart,
  createOrderShipment,
  createReturnRequest,
  getBuyerOrderById,
  getSellerOrderById,
  listBuyerOrders,
  listReturnRequests,
  listSellerOrders,
  updateOrderItemStatus,
  updateOrderStatus,
} from '@/features/buyers/orders/order.service';

const buyerWithOrderId = buyerWithParams(orderIdParamSchema);

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

const sellerWithOrderItemWrite = {
  preHandler: [
    ...sellerOrdersWrite.preHandler,
    validateParams(orderItemParamsSchema),
  ],
};

export default async function orderRoutes(fastify: FastifyInstance) {
  fastify.get('/', buyerOnly, async (req, reply) => {
    try {
      const orders = await listBuyerOrders(req.auth!.userId);
      return reply.status(200).send({ orders });
    } catch (error) {
      return handleRouteError(reply, error, 'Sipariş işlemi sırasında bir hata oluştu');
    }
  });

  fastify.get('/returns', buyerOnly, async (req, reply) => {
    try {
      const returns = await listReturnRequests(req.auth!.userId);
      return reply.status(200).send({ returns });
    } catch (error) {
      return handleRouteError(reply, error, 'İade talebi işlemi sırasında bir hata oluştu');
    }
  });

  fastify.get('/seller', sellerOrdersRead, async (req, reply) => {
    try {
      const orders = await listSellerOrders(req.sellerContext!.companyId);
      return reply.status(200).send({ orders });
    } catch (error) {
      return handleRouteError(reply, error, 'Sipariş işlemi sırasında bir hata oluştu');
    }
  });

  fastify.post(
    '/',
    { preHandler: [...buyerOnly.preHandler, validateBody(createOrderSchema)] },
    async (req, reply) => {
      try {
        const order = await createOrderFromCart(req.auth!.userId, req.body as CreateOrderInput);

        return reply.status(201).send({
          message: 'Sipariş oluşturuldu',
          order,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Sipariş işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.get('/seller/:orderId', sellerWithOrderId, async (req, reply) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const order = await getSellerOrderById(req.sellerContext!.companyId, orderId);
      return reply.status(200).send({ order });
    } catch (error) {
      return handleRouteError(reply, error, 'Sipariş işlemi sırasında bir hata oluştu');
    }
  });

  fastify.get('/:orderId', buyerWithOrderId, async (req, reply) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const order = await getBuyerOrderById(req.auth!.userId, orderId);
      return reply.status(200).send({ order });
    } catch (error) {
      return handleRouteError(reply, error, 'Sipariş işlemi sırasında bir hata oluştu');
    }
  });

  fastify.post('/:orderId/cancel', buyerWithOrderId, async (req, reply) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const order = await cancelBuyerPendingOrder(req.auth!.userId, orderId);

      return reply.status(200).send({
        message: 'Sipariş iptal edildi',
        order,
      });
    } catch (error) {
      return handleRouteError(reply, error, 'Sipariş işlemi sırasında bir hata oluştu');
    }
  });

  fastify.post(
    '/:orderId/returns',
    {
      preHandler: [...buyerWithOrderId.preHandler, validateBody(createReturnRequestSchema)],
    },
    async (req, reply) => {
      try {
        const { orderId } = req.params as { orderId: string };
        const returnRequest = await createReturnRequest(
          req.auth!.userId,
          orderId,
          req.body as CreateReturnRequestBody
        );

        return reply.status(201).send({
          message: 'Talep oluşturuldu',
          returnRequest,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'İade talebi işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.post(
    '/:orderId/shipments',
    {
      preHandler: [...sellerWithOrderIdWrite.preHandler, validateBody(createShipmentSchema)],
    },
    async (req, reply) => {
      try {
        const { orderId } = req.params as { orderId: string };
        const shipment = await createOrderShipment(
          req.sellerContext!.companyId,
          orderId,
          req.body as CreateShipmentInput
        );

        return reply.status(201).send({
          message: 'Kargo bilgisi eklendi',
          shipment,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Kargo işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.patch(
    '/:orderId/items/:productId/status',
    {
      preHandler: [
        ...sellerWithOrderItemWrite.preHandler,
        validateBody(updateOrderItemStatusSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { orderId, productId } = req.params as { orderId: string; productId: string };
        const order = await updateOrderItemStatus(
          req.sellerContext!.companyId,
          orderId,
          productId,
          req.body as UpdateOrderItemStatusInput
        );

        return reply.status(200).send({
          message: 'Sipariş kalemi güncellendi',
          order,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Sipariş işlemi sırasında bir hata oluştu');
      }
    }
  );

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
