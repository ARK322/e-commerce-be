import type { PaymentStatus } from '@/infrastructure/mongo';
import { refundIyzicoPayment } from '@/infrastructure/iyzico/refund-payment';
import { createLogger } from '@/shared/logging';
import { logPaymentTransition } from '@/domain/payment/payment-audit';
import {
  savePaymentDocument,
  updatePaymentStatusByOrderId,
} from '@/repositories/buyers/payment.repository';

const log = createLogger({ module: 'payment-refund' });

type RefundablePayment = {
  _id: unknown;
  orderId: string;
  amount: number;
  status: string;
  save: () => Promise<unknown>;
};

export const refundCapturedIyzicoPayment = async (
  payment: RefundablePayment,
  iyzicoPaymentId: string,
  reason: string
): Promise<boolean> => {
  const refunded = await refundIyzicoPayment(iyzicoPaymentId, payment.amount, payment.orderId);

  const nextStatus: PaymentStatus = refunded ? 'refunded' : 'failed';
  const prevStatus = payment.status as PaymentStatus;

  payment.status = nextStatus;
  await savePaymentDocument(payment);

  logPaymentTransition({
    paymentId: String(payment._id),
    orderId: payment.orderId,
    from: prevStatus,
    to: nextStatus,
    reason,
  });

  if (!refunded) {
    log.error(
      { orderId: payment.orderId, paymentId: payment._id, iyzicoPaymentId },
      'Iyzico iadesi başarısız; manuel müdahale gerekir'
    );
  }

  return refunded;
};

export const failPaymentByOrderId = async (orderId: string, fromStatus: PaymentStatus) => {
  const updated = await updatePaymentStatusByOrderId(orderId, 'failed');

  if (updated) {
    logPaymentTransition({
      paymentId: String(updated._id),
      orderId,
      from: fromStatus,
      to: 'failed',
      reason: 'capture_unfulfillable',
    });
  }

  return updated;
};
