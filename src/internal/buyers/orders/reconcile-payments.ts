import { Order, Payment } from '@/integrations/mongo';
import { refundIyzicoPayment } from '@/integrations/iyzico/refund-payment';
import { createLogger } from '@/internal/common/logging';

const log = createLogger({ module: 'payment-reconcile' });

export const reconcilePaymentOrderMismatches = async (): Promise<number> => {
  const mismatches = await Payment.find({
    status: 'completed',
    provider: 'iyzico',
    externalId: { $ne: null },
  }).lean();

  let handled = 0;

  for (const payment of mismatches) {
    const order = await Order.findById(payment.orderId).lean();

    if (!order || order.status === 'paid' || order.status === 'shipped' || order.status === 'delivered') {
      continue;
    }

    log.error(
      {
        orderId: payment.orderId,
        paymentId: payment._id,
        orderStatus: order.status,
        externalId: payment.externalId,
      },
      'Ödeme tamamlandı ancak sipariş uyumsuz; iade deneniyor'
    );

    const refunded = payment.externalId
      ? await refundIyzicoPayment(String(payment.externalId), payment.amount, payment.orderId)
      : false;

    await Payment.findByIdAndUpdate(payment._id, {
      $set: {
        status: refunded ? 'refunded' : 'completed',
        updatedAt: new Date(),
      },
    });

    if (!refunded) {
      log.error(
        { orderId: payment.orderId, paymentId: payment._id },
        'Otomatik iade başarısız; manuel müdahale gerekir'
      );
    }

    handled += 1;
  }

  return handled;
};

export const startPaymentReconciliationScheduler = (): void => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const run = () => {
    void reconcilePaymentOrderMismatches().catch((err) => {
      log.error({ err }, 'Ödeme-sipariş uzlaştırma işi başarısız');
    });
  };

  run();
  setInterval(run, 5 * 60_000);
};
