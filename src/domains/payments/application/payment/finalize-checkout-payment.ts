import type { PaymentStatus } from '@/integrations/mongo';
import { findOrderByIdLean } from '@/domains/commerce/infrastructure/repositories/order.repository';
import {
  claimPendingPaymentForProcessing,
  findPaymentByOrderId,
  savePaymentDocument,
  updatePaymentStatusByOrderId,
} from '@/domains/payments/infrastructure/repositories/payment.repository';
import type { CompleteCheckoutResult } from '@/integrations/iyzico/types';
import { CommerceError } from '@/shared/errors/commerce-error';
import { logger } from '@/shared/logging';
import {
  buildPaymentSplitsForOrder,
} from '@/domains/payments/application/payment/payment-split';
import { ensurePostPaymentSideEffects } from '@/domains/payments/application/payment/post-payment-side-effects';
import { logPaymentTransition } from '@/domains/payments/application/payment/payment-audit';
import { refundCapturedIyzicoPayment } from '@/domains/payments/application/payment/refund-captured-payment';
import { cancelPendingOrder } from '@/domains/commerce/application/orders/cancel-pending-order';
import { enqueueOrderConfirmationEmail } from '@/domains/commerce/application/orders/enqueue-order-confirmation';
import { fulfillPaidOrder } from '@/domains/commerce/application/orders/fulfill-order';

const AMOUNT_TOLERANCE = 0.01;
const FINAL_ORDER_STATUSES = new Set(['paid', 'shipped', 'delivered']);

type PaymentRecord = {
  _id: unknown;
  orderId: string;
  buyerId: string;
  amount: number;
  currency: string;
  provider?: string | null;
  externalId?: string | null;
  status: PaymentStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

export const toPaymentResponse = (payment: PaymentRecord) => ({
  id: String(payment._id),
  orderId: payment.orderId,
  buyerId: payment.buyerId,
  amount: payment.amount,
  currency: payment.currency,
  provider: payment.provider ?? null,
  externalId: payment.externalId ?? null,
  status: payment.status,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
});

const amountsMatch = (expected: number, actual: number): boolean =>
  Math.abs(expected - actual) <= AMOUNT_TOLERANCE;

const isFinalOrderStatus = (status: string | undefined): boolean =>
  Boolean(status && FINAL_ORDER_STATUSES.has(status));

const markPaymentCompleted = async (
  payment: {
    _id: unknown;
    orderId: string;
    status: string;
    provider?: string | null;
    externalId?: string | null;
    save: () => Promise<unknown>;
  },
  externalId: string
) => {
  const prevStatus = payment.status as PaymentStatus;
  payment.status = 'completed';
  payment.provider = 'iyzico';
  payment.externalId = externalId;
  await savePaymentDocument(payment);
  logPaymentTransition({
    paymentId: String(payment._id),
    orderId: payment.orderId,
    from: prevStatus,
    to: 'completed',
    reason: 'iyzico_checkout_verified',
  });
};

const runPostPaymentSideEffects = ensurePostPaymentSideEffects;

const handleFulfillmentFailure = async (
  payment: {
    _id: unknown;
    orderId: string;
    amount: number;
    status: string;
    provider?: string | null;
    externalId?: string | null;
    save: () => Promise<unknown>;
  },
  externalId: string,
  error: unknown
): Promise<never> => {
  await refundCapturedIyzicoPayment(payment, externalId, 'fulfillment_failed_refund');
  await cancelPendingOrder(payment.orderId);

  logger.error(
    { err: error, orderId: payment.orderId },
    'Ödeme alındı ancak sipariş tamamlanamadı'
  );

  throw error;
};

const refundUnfulfillableCapture = async (
  payment: {
    _id: unknown;
    orderId: string;
    amount: number;
    status: string;
    buyerId?: string;
    currency?: string;
    provider?: string | null;
    externalId?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    save: () => Promise<unknown>;
    toObject: () => PaymentRecord;
  },
  externalId: string,
  reason: string
) => {
  await refundCapturedIyzicoPayment(payment, externalId, reason);

  return {
    payment: toPaymentResponse(payment.toObject() as PaymentRecord),
    success: false as const,
    reason: 'order_not_payable',
  };
};

const finalizeProcessingPayment = async (
  payment: {
    _id: unknown;
    orderId: string;
    amount: number;
    status: string;
    provider?: string | null;
    externalId?: string | null;
    save: () => Promise<unknown>;
    toObject: () => PaymentRecord;
  },
  order: {
    status: string;
    totalAmount: number;
    items: Array<{ productId: string; quantity: number }>;
  },
  result: Extract<CompleteCheckoutResult, { status: 'completed' }>
) => {
  if (!amountsMatch(order.totalAmount, result.paidAmount)) {
    logger.error(
      {
        orderId: result.orderId,
        expected: order.totalAmount,
        paid: result.paidAmount,
      },
      'Iyzico ödeme tutarı sipariş tutarıyla uyuşmuyor'
    );

    return refundUnfulfillableCapture(
      payment,
      result.externalId,
      'amount_mismatch_refund'
    );
  }

  try {
    await fulfillPaidOrder(
      result.orderId,
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }))
    );
  } catch (error) {
    if (error instanceof CommerceError && error.statusCode === 409) {
      const refreshed = await findOrderByIdLean(result.orderId);

      if (isFinalOrderStatus(refreshed?.status)) {
        await markPaymentCompleted(payment, result.externalId);
        await runPostPaymentSideEffects(result.orderId, result.itemTransactions);

        return {
          payment: toPaymentResponse(payment.toObject()),
          success: true as const,
        };
      }
    }

    await handleFulfillmentFailure(payment, result.externalId, error);
  }

  await markPaymentCompleted(payment, result.externalId);
  await runPostPaymentSideEffects(result.orderId, result.itemTransactions);
  await enqueueOrderConfirmationEmail(result.orderId);

  return {
    payment: toPaymentResponse(payment.toObject()),
    success: true as const,
  };
};

export const finalizeSuccessfulIyzicoCheckout = async (
  result: Extract<CompleteCheckoutResult, { status: 'completed' }>
) => {
  let payment = await findPaymentByOrderId(result.orderId);

  if (!payment) {
    throw new CommerceError(404, 'Ödeme kaydı bulunamadı');
  }

  if (payment.status === 'completed') {
    const order = await findOrderByIdLean(result.orderId);

    if (isFinalOrderStatus(order?.status)) {
      await runPostPaymentSideEffects(result.orderId, result.itemTransactions);

      return {
        payment: toPaymentResponse(payment.toObject() as PaymentRecord),
        success: true as const,
      };
    }
  }

  const order = await findOrderByIdLean(result.orderId);

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  if (isFinalOrderStatus(order.status)) {
    if (payment.status !== 'completed') {
      await markPaymentCompleted(payment, result.externalId);
    }

    await runPostPaymentSideEffects(result.orderId, result.itemTransactions);

    return {
      payment: toPaymentResponse(payment.toObject() as PaymentRecord),
      success: true as const,
    };
  }

  if (order.status !== 'pending') {
    if (payment.status === 'pending' || payment.status === 'processing') {
      const claimed =
        payment.status === 'pending'
          ? await claimPendingPaymentForProcessing(result.orderId)
          : payment;

      if (claimed) {
        return refundUnfulfillableCapture(
          claimed,
          result.externalId,
          order.status === 'cancelled' ? 'order_cancelled_refund' : 'order_not_pending_refund'
        );
      }
    }

    throw new CommerceError(409, 'Sipariş ödemeye uygun değil');
  }

  if (payment.status === 'completed') {
    throw new CommerceError(409, 'Ödeme zaten tamamlandı, sipariş uzlaştırması bekleniyor');
  }

  if (payment.status !== 'processing') {
    const claimedPayment = await claimPendingPaymentForProcessing(result.orderId);

    if (claimedPayment) {
      logPaymentTransition({
        paymentId: String(claimedPayment._id),
        orderId: claimedPayment.orderId,
        from: 'pending',
        to: 'processing',
        reason: 'callback_claim',
      });
      payment = claimedPayment;
    } else {
      const latestPayment = await findPaymentByOrderId(result.orderId);

      if (!latestPayment) {
        throw new CommerceError(404, 'Ödeme kaydı bulunamadı');
      }

      payment = latestPayment;

      if (payment.status === 'completed') {
        await runPostPaymentSideEffects(result.orderId, result.itemTransactions);

        return {
          payment: toPaymentResponse(payment.toObject() as PaymentRecord),
          success: true as const,
        };
      }

      if (payment.status !== 'processing') {
        throw new CommerceError(409, 'Ödeme işleme alınamadı');
      }
    }
  }

  if (payment.status !== 'processing') {
    throw new CommerceError(409, 'Ödeme işleme alınamadı');
  }

  return finalizeProcessingPayment(payment, order, result);
};

export const finalizeFailedIyzicoCheckout = async (orderId: string, reason: string) => {
  const payment = await findPaymentByOrderId(orderId);

  if (!payment) {
    throw new CommerceError(404, 'Ödeme kaydı bulunamadı');
  }

  if (payment.status === 'completed' || payment.status === 'refunded') {
    return {
      payment: toPaymentResponse(payment.toObject() as PaymentRecord),
      success: false as const,
      reason,
    };
  }

  const previousStatus = payment.status;
  const updated = await updatePaymentStatusByOrderId(orderId, 'failed');
  const resolvedPayment = updated ?? payment;

  if (previousStatus !== 'failed') {
    logPaymentTransition({
      paymentId: String(resolvedPayment._id),
      orderId: resolvedPayment.orderId,
      from: previousStatus,
      to: 'failed',
      reason: 'iyzico_checkout_failed',
    });
  }

  await cancelPendingOrder(orderId);

  return {
    payment: toPaymentResponse(resolvedPayment.toObject() as PaymentRecord),
    success: false as const,
    reason,
  };
};
