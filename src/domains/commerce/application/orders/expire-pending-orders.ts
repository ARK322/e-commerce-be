import { env } from '@/config/env';
import { logger } from '@/shared/logging';
import { cancelPendingOrder } from '@/domains/commerce/application/orders/cancel-pending-order';
import { findExpiringPendingOrdersLean } from '@/domains/commerce/infrastructure/repositories/order.repository';
import {
  distinctPendingCheckoutOrderIds,
  failStalePendingPayments,
} from '@/domains/payments/infrastructure/repositories/payment.repository';

export const expirePendingOrders = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - env.pendingOrderTtlMs);

  const activeCheckoutOrderIds = await distinctPendingCheckoutOrderIds();

  const expiringOrders = await findExpiringPendingOrdersLean(cutoff, activeCheckoutOrderIds);

  let cancelledCount = 0;
  for (const order of expiringOrders) {
    if (await cancelPendingOrder(String(order._id))) {
      cancelledCount += 1;
    }
  }

  if (activeCheckoutOrderIds.length > 0) {
    await failStalePendingPayments(activeCheckoutOrderIds, cutoff);
  }

  return cancelledCount;
};

export const startPendingOrderExpiryScheduler = (): void => {
  if (env.nodeEnv === 'test') {
    return;
  }

  const run = () => {
    void expirePendingOrders()
      .then((count) => {
        if (count > 0) {
          logger.info({ count }, 'Süresi dolan pending siparişler iptal edildi');
        }
      })
      .catch((err) => {
        logger.error({ err }, 'Pending sipariş süre aşımı işi başarısız');
      });
  };

  run();
  setInterval(run, env.pendingOrderExpiryIntervalMs);
};
