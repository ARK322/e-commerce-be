import { FastifyInstance } from 'fastify';
import { validateBody } from '@/shared/middleware/validation/validate-body';
import { orderIdParamSchema } from '@/shared/validation/param-schemas';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { buyerOnly, buyerWithParams } from '@/shared/middleware/presets/buyer-route-guards';
import { createOrderSchema, type CreateOrderInput } from '@/api/buyer/orders/create-order.schema';
import {
  cancelBuyerPendingOrder,
  createOrderFromCart,
  getBuyerOrderById,
  listBuyerOrders,
} from '@/api/buyer/orders/order.service';

const buyerWithOrderId = buyerWithParams(orderIdParamSchema);

export default async function orderRoutes(fastify: FastifyInstance) {
  fastify.get('/', buyerOnly, async (req, reply) => {
    try {
      const orders = await listBuyerOrders(req.auth!.userId);
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
}
