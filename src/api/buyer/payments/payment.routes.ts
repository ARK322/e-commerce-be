import { FastifyInstance } from 'fastify';
import { validateBody } from '@/shared/middleware/validation/validate-body';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { PAYMENT_CALLBACK_RATE_LIMIT } from '@/shared/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/shared/plugins/rate-limit/register-scoped';
import { orderIdParamSchema } from '@/shared/validation/param-schemas';
import { buyerOnly, buyerWithParams } from '@/shared/middleware/presets/buyer-route-guards';
import {
  createPaymentSchema,
  type CreatePaymentInput,
} from '@/api/buyer/payments/create-payment.schema';
import {
  createPaymentForOrder,
  getPaymentByOrderId,
  handlePaymentCallback,
} from '@/api/buyer/payments/payment.service';

const buyerWithOrderId = buyerWithParams(orderIdParamSchema);

export default async function paymentRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    { preHandler: [...buyerOnly.preHandler, validateBody(createPaymentSchema)] },
    async (req, reply) => {
      try {
        const result = await createPaymentForOrder(
          req.auth!.userId,
          req.body as CreatePaymentInput,
          { clientIp: req.ip }
        );

        return reply.status(201).send({
          message: 'Ödeme sayfasına yönlendiriliyorsunuz',
          payment: result.payment,
          checkout: result.checkout,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Ödeme işlemi sırasında bir hata oluştu', {
          duplicateKeyMessage: 'Bu sipariş için ödeme kaydı zaten var',
        });
      }
    }
  );

  await fastify.register(async (callbackScope) => {
    await registerScopedRateLimit(callbackScope, PAYMENT_CALLBACK_RATE_LIMIT);

    callbackScope.post('/callback', async (req, reply) => {
      const redirectUrl = await handlePaymentCallback(req.body);
      return reply.redirect(redirectUrl);
    });
  });

  fastify.get('/order/:orderId', buyerWithOrderId, async (req, reply) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const payment = await getPaymentByOrderId(req.auth!.userId, orderId);

      return reply.status(200).send({ payment });
    } catch (error) {
      return handleRouteError(reply, error, 'Ödeme işlemi sırasında bir hata oluştu');
    }
  });
}
