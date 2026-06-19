import { FastifyInstance, FastifyReply } from 'fastify';
import { Payment } from '@/integrations/mongo';
import { env } from '@/config/env';
import { validateBody } from '@/middleware/validation/validate-body';
import { handleRouteError } from '@/internal/errors/handle-route-error';
import { logger } from '@/internal/logging';
import { disabledRouteRateLimit } from '@/middleware/presets/rate-limit';
import { orderIdParamSchema } from '@/internal/validation/param-schemas';
import { buyerOnly, buyerWithParams } from '@/middleware/presets/buyer-route-guards';
import {
  createPaymentSchema,
  type CreatePaymentInput,
} from '@/features/ecommerce/payment/create-payment.schema';
import {
  completePaymentFromCheckoutToken,
  createPaymentForOrder,
  getPaymentByOrderId,
} from '@/features/ecommerce/payment/payment.service';

const buyerWithOrderId = buyerWithParams(orderIdParamSchema);

const parseFormBody = (body: unknown): Record<string, string> => {
  if (typeof body === 'string') {
    return Object.fromEntries(new URLSearchParams(body));
  }

  if (Buffer.isBuffer(body)) {
    return Object.fromEntries(new URLSearchParams(body.toString('utf8')));
  }

  if (typeof body === 'object' && body !== null) {
    return Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, String(value)])
    );
  }

  return {};
};

const buildPaymentRedirectUrl = (
  outcome: 'success' | 'failed',
  orderId?: string | null
): string => {
  const frontendUrl = env.frontendUrlOrDefault.replace(/\/+$/, '');

  if (orderId) {
    return `${frontendUrl}/orders/${orderId}?payment=${outcome}`;
  }

  return `${frontendUrl}/checkout?payment=${outcome}`;
};

const findOrderIdByCheckoutToken = async (token: string): Promise<string | null> => {
  const payment = await Payment.findOne({ externalId: token }).select('orderId').lean();
  return payment?.orderId ?? null;
};

const redirectPaymentOutcome = (
  reply: FastifyReply,
  outcome: 'success' | 'failed',
  orderId?: string | null
) => reply.redirect(buildPaymentRedirectUrl(outcome, orderId));

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

  fastify.post('/callback', { config: disabledRouteRateLimit }, async (req, reply) => {
    let checkoutToken: string | undefined;

    try {
      const form = parseFormBody(req.body);
      checkoutToken = form.token?.trim();

      if (!checkoutToken) {
        return redirectPaymentOutcome(reply, 'failed');
      }

      const result = await completePaymentFromCheckoutToken(checkoutToken);

      if (!result.success) {
        return redirectPaymentOutcome(reply, 'failed', result.payment.orderId);
      }

      return redirectPaymentOutcome(reply, 'success', result.payment.orderId);
    } catch (error) {
      const orderId = checkoutToken ? await findOrderIdByCheckoutToken(checkoutToken) : null;

      logger.error(
        { err: error, checkoutToken, orderId },
        'Iyzico ödeme callback doğrulaması başarısız'
      );

      return redirectPaymentOutcome(reply, 'failed', orderId);
    }
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
