import { completeIyzicoCheckout } from '@/integrations/iyzico/retrieve-checkout';
import { createLogger } from '@/shared/logging';
import {
  finalizeFailedIyzicoCheckout,
  finalizeSuccessfulIyzicoCheckout,
} from '@/domains/payments/application/payment/finalize-checkout-payment';
import { refundCapturedIyzicoPayment } from '@/domains/payments/application/payment/refund-captured-payment';
import { findOrderByIdLean } from '@/domains/commerce/infrastructure/repositories/order.repository';
import {
  findPaymentByOrderId,
  listStuckProcessingPaymentsLean,
  updatePaymentStatusByOrderId,
} from '@/domains/payments/infrastructure/repositories/payment.repository';

const log = createLogger({ module: 'recover-stuck-payments' });

const STUCK_PROCESSING_MS = 5 * 60_000;
const FINAL_ORDER_STATUSES = new Set(['paid', 'shipped', 'delivered']);

const isFinalOrderStatus = (status: string | undefined): boolean =>
  Boolean(status && FINAL_ORDER_STATUSES.has(status));

export const recoverStuckProcessingPayments = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - STUCK_PROCESSING_MS);
  const stuckPayments = await listStuckProcessingPaymentsLean(cutoff);
  let handled = 0;

  for (const payment of stuckPayments) {
    const checkoutToken = payment.externalId ? String(payment.externalId) : null;

    if (!checkoutToken) {
      await updatePaymentStatusByOrderId(payment.orderId, 'failed');
      handled += 1;
      continue;
    }

    try {
      const result = await completeIyzicoCheckout(checkoutToken);

      if (result.status === 'failed') {
        await finalizeFailedIyzicoCheckout(result.orderId, result.reason);
        handled += 1;
        continue;
      }

      const order = await findOrderByIdLean(payment.orderId);

      if (!order) {
        const paymentDoc = await findPaymentByOrderId(payment.orderId);

        if (paymentDoc) {
          await refundCapturedIyzicoPayment(
            paymentDoc,
            result.externalId,
            'stuck_missing_order_refund'
          );
        }

        handled += 1;
        continue;
      }

      if (order.status === 'cancelled') {
        const paymentDoc = await findPaymentByOrderId(payment.orderId);

        if (paymentDoc) {
          await refundCapturedIyzicoPayment(
            paymentDoc,
            result.externalId,
            'order_cancelled_refund'
          );
        }

        handled += 1;
        continue;
      }

      if (order.status === 'pending' || isFinalOrderStatus(order.status)) {
        await finalizeSuccessfulIyzicoCheckout(result);
        handled += 1;
        continue;
      }

      const paymentDoc = await findPaymentByOrderId(payment.orderId);

      if (paymentDoc) {
        await refundCapturedIyzicoPayment(
          paymentDoc,
          result.externalId,
          'stuck_processing_refund'
        );
      }

      handled += 1;
    } catch (error) {
      log.error(
        { err: error, orderId: payment.orderId, paymentId: payment._id },
        'Takılı processing ödeme kurtarılamadı'
      );
    }
  }

  return handled;
};

export const startStuckPaymentRecoveryScheduler = (): void => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const run = () => {
    void recoverStuckProcessingPayments().catch((err) => {
      log.error({ err }, 'Takılı ödeme kurtarma işi başarısız');
    });
  };

  run();
  setInterval(run, 5 * 60_000);
};
