import { completeIyzicoCheckout } from '@/infrastructure/iyzico/retrieve-checkout';
import { refundIyzicoPayment } from '@/infrastructure/iyzico/refund-payment';
import { createLogger } from '@/shared/logging';
import {
  finalizeFailedIyzicoCheckout,
  finalizeSuccessfulIyzicoCheckout,
} from '@/domain/payment/finalize-checkout-payment';
import { refundCapturedIyzicoPayment } from '@/domain/payment/refund-captured-payment';
import { findOrderByIdLean } from '@/repositories/buyers/order.repository';
import {
  findPaymentById,
  listCompletedIyzicoPaymentsLean,
  listProcessingIyzicoPaymentsLean,
  updatePaymentById,
} from '@/repositories/buyers/payment.repository';

const log = createLogger({ module: 'payment-reconcile' });

const STUCK_PROCESSING_MS = 5 * 60_000;
const FINAL_ORDER_STATUSES = new Set(['paid', 'shipped', 'delivered']);

const isFinalOrderStatus = (status: string | undefined): boolean =>
  Boolean(status && FINAL_ORDER_STATUSES.has(status));

const reconcileCompletedPaymentMismatch = async (payment: {
  _id: unknown;
  orderId: string;
  amount: number;
  externalId?: string | null;
}) => {
  const order = await findOrderByIdLean(payment.orderId);

  if (!order || isFinalOrderStatus(order.status)) {
    return false;
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

  await updatePaymentById(String(payment._id), {
    status: refunded ? 'refunded' : 'completed',
    updatedAt: new Date(),
  });

  if (!refunded) {
    log.error(
      { orderId: payment.orderId, paymentId: payment._id },
      'Otomatik iade başarısız; manuel müdahale gerekir'
    );
  }

  return true;
};

const reconcileStuckProcessingPayment = async (paymentId: string) => {
  const payment = await findPaymentById(paymentId);

  if (!payment) {
    return false;
  }

  const checkoutToken = payment.externalId ? String(payment.externalId) : null;

  if (!checkoutToken) {
    await updatePaymentById(paymentId, {
      status: 'failed',
      updatedAt: new Date(),
    });
    return true;
  }

  try {
    const result = await completeIyzicoCheckout(checkoutToken);

    if (result.status === 'failed') {
      await finalizeFailedIyzicoCheckout(result.orderId, result.reason);
      return true;
    }

    const order = await findOrderByIdLean(payment.orderId);

    if (!order) {
      await refundCapturedIyzicoPayment(payment, result.externalId, 'reconcile_missing_order_refund');
      return true;
    }

    if (order.status === 'cancelled') {
      await refundCapturedIyzicoPayment(payment, result.externalId, 'order_cancelled_refund');
      return true;
    }

    if (order.status === 'pending' || isFinalOrderStatus(order.status)) {
      await finalizeSuccessfulIyzicoCheckout(result);
      return true;
    }

    await refundCapturedIyzicoPayment(payment, result.externalId, 'reconcile_processing_refund');
    return true;
  } catch (error) {
    log.error(
      { err: error, orderId: payment.orderId, paymentId },
      'Processing ödeme uzlaştırması başarısız'
    );
  }

  return false;
};

export const reconcilePaymentOrderMismatches = async (): Promise<number> => {
  const processingCutoff = new Date(Date.now() - STUCK_PROCESSING_MS);
  const [completedMismatches, processingPayments] = await Promise.all([
    listCompletedIyzicoPaymentsLean(),
    listProcessingIyzicoPaymentsLean(processingCutoff),
  ]);

  let handled = 0;

  for (const payment of completedMismatches) {
    if (await reconcileCompletedPaymentMismatch(payment)) {
      handled += 1;
    }
  }

  for (const payment of processingPayments) {
    if (await reconcileStuckProcessingPayment(String(payment._id))) {
      handled += 1;
    }
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
