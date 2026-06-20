import { Order, Payment } from '@/integrations/mongo';
import { env } from '@/config/env';
import { logger } from '@/internal/common/logging';

export const expirePendingOrders = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - env.pendingOrderTtlMs);

  const activeCheckoutOrderIds = await Payment.distinct('orderId', {
    status: 'pending',
    externalId: { $ne: null },
  });

  const result = await Order.updateMany(
    {
      status: 'pending',
      createdAt: { $lt: cutoff },
      _id: { $nin: activeCheckoutOrderIds },
    },
    { $set: { status: 'cancelled', updatedAt: new Date() } }
  );

  if (activeCheckoutOrderIds.length > 0) {
    await Payment.updateMany(
      {
        orderId: { $in: activeCheckoutOrderIds },
        status: 'pending',
        updatedAt: { $lt: cutoff },
      },
      { $set: { status: 'failed', updatedAt: new Date() } }
    );
  }

  return result.modifiedCount ?? 0;
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
