import type { PaymentStatus } from '@/infrastructure/mongo';
import { refundIyzicoPayment } from '@/infrastructure/iyzico/refund-payment';
import { createLogger } from '@/shared/logging';
import { logPaymentTransition } from '@/domain/payment/payment-audit';
import {
  savePaymentDocument,
  updatePaymentStatusByOrderId,
} from '@/repositories/buyers/payment.repository';

const log = createLogger({ module: 'payment-refund' });

const roundMoney = (value: number) => Math.round(value * 100) / 100;

type RefundablePayment = {
  _id: unknown;
  orderId: string;
  amount: number;
  refundedAmount?: number | null;
  status: string;
  save: () => Promise<unknown>;
};

export const refundCapturedIyzicoPayment = async (
  payment: RefundablePayment,
  iyzicoPaymentId: string,
  reason: string,
  refundAmount?: number
): Promise<boolean> => {
  const alreadyRefunded = payment.refundedAmount ?? 0;
  const remainingRefundable = roundMoney(Math.max(0, payment.amount - alreadyRefunded));
  const amountToRefund = roundMoney(refundAmount ?? remainingRefundable);

  if (amountToRefund <= 0 || amountToRefund > remainingRefundable + 0.001) {
    log.error(
      {
        orderId: payment.orderId,
        paymentId: payment._id,
        amountToRefund,
        remainingRefundable,
      },
      'Geçersiz iade tutarı'
    );
    return false;
  }

  const refunded = await refundIyzicoPayment(iyzicoPaymentId, amountToRefund, payment.orderId);
  const prevStatus = payment.status as PaymentStatus;

  if (!refunded) {
    if (alreadyRefunded === 0) {
      payment.status = 'failed';
      await savePaymentDocument(payment);
      logPaymentTransition({
        paymentId: String(payment._id),
        orderId: payment.orderId,
        from: prevStatus,
        to: 'failed',
        reason,
      });
    }

    log.error(
      { orderId: payment.orderId, paymentId: payment._id, iyzicoPaymentId, amountToRefund },
      'Iyzico iadesi başarısız; manuel müdahale gerekir'
    );
    return false;
  }

  const nextRefundedAmount = roundMoney(alreadyRefunded + amountToRefund);
  payment.refundedAmount = nextRefundedAmount;
  payment.status =
    nextRefundedAmount >= payment.amount - 0.001 ? 'refunded' : 'completed';
  await savePaymentDocument(payment);

  logPaymentTransition({
    paymentId: String(payment._id),
    orderId: payment.orderId,
    from: prevStatus,
    to: payment.status as PaymentStatus,
    reason,
  });

  return true;
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
