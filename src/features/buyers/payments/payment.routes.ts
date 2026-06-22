import { FastifyInstance } from 'fastify';
import { validateBody } from '@/middleware/validation/validate-body';
import { handleRouteError } from '@/internal/common/errors/handle-route-error';
import { PAYMENT_CALLBACK_RATE_LIMIT } from '@/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/plugins/rate-limit/register-scoped';
import { orderIdParamSchema } from '@/internal/common/validation/param-schemas';
import { buyerOnly, buyerWithParams } from '@/middleware/presets/buyer-route-guards';
import {
  createPaymentSchema,
  type CreatePaymentInput,
} from '@/features/buyers/payments/create-payment.schema';
import {
  buildPaymentRedirectUrl,
  createPaymentForOrder,
  getPaymentByOrderId,
  handlePaymentCallback,
} from '@/features/buyers/payments/payment.service';
import { disabledRouteRateLimit } from '@/middleware/presets/rate-limit';
import { logger } from '@/internal/common/logging';

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

    callbackScope.post(
      '/callback',
      { config: disabledRouteRateLimit },
      async (req, reply) => {
        try {
          const redirectUrl = await handlePaymentCallback(req.body);
          return reply.redirect(redirectUrl, 303);
        } catch (error) {
          logger.error({ err: error }, 'Ödeme callback işleyicisi beklenmeyen hata verdi');

          return reply.redirect(buildPaymentRedirectUrl('failed'), 303);
        }
      }
    );
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
