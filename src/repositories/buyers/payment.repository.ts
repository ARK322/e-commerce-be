import type { PaymentCurrency, PaymentStatus } from '@/infrastructure/mongo';
import { Payment } from '@/infrastructure/mongo';
import { createUserId } from '@/shared/ids';

export const findOrderIdByCheckoutToken = async (token: string): Promise<string | null> => {
  const payment = await Payment.findOne({ externalId: token }).select('orderId').lean();
  return payment?.orderId ?? null;
};

export const findPaymentByOrderId = async (orderId: string) => Payment.findOne({ orderId });

export const findPaymentByOrderIdLean = async (orderId: string) =>
  Payment.findOne({ orderId }).lean();

export const findPaymentById = async (paymentId: string) => Payment.findById(paymentId);

type CreatePaymentData = {
  orderId: string;
  buyerId: string;
  amount: number;
  currency: PaymentCurrency;
  provider: string;
  status: PaymentStatus;
};

export const createPayment = async (data: CreatePaymentData) =>
  Payment.create({
    _id: createUserId(),
    ...data,
  });

export const savePaymentDocument = async (payment: {
  updatedAt?: Date;
  save: () => Promise<unknown>;
}) => {
  payment.updatedAt = new Date();
  await payment.save();
};

export const claimPendingPaymentForProcessing = async (orderId: string) =>
  typeof (Payment as { findOneAndUpdate?: unknown }).findOneAndUpdate === 'function'
    ? Payment.findOneAndUpdate(
        { orderId, status: 'pending' },
        { $set: { status: 'processing', updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
    : (async () => {
        const payment = await Payment.findOne({ orderId, status: 'pending' });
        if (!payment) {
          return null;
        }

        payment.status = 'processing';
        payment.updatedAt = new Date();
        await payment.save();
        return payment;
      })();

export const updatePaymentStatusByOrderId = async (
  orderId: string,
  status: PaymentStatus
) =>
  typeof (Payment as { findOneAndUpdate?: unknown }).findOneAndUpdate === 'function'
    ? Payment.findOneAndUpdate(
        { orderId },
        { $set: { status, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
    : (async () => {
        const payment = await Payment.findOne({ orderId });
        if (!payment) {
          return null;
        }

        payment.status = status;
        payment.updatedAt = new Date();
        await payment.save();
        return payment;
      })();

export const failPendingPaymentsByOrderId = async (orderId: string) =>
  Payment.updateMany(
    { orderId, status: { $in: ['pending', 'processing'] } },
    { $set: { status: 'failed', updatedAt: new Date() } }
  );

export const distinctPendingCheckoutOrderIds = async () =>
  Payment.distinct('orderId', {
    status: { $in: ['pending', 'processing'] },
    externalId: { $ne: null },
  });

export const listStuckProcessingPaymentsLean = async (cutoff: Date) =>
  Payment.find({
    status: 'processing',
    updatedAt: { $lt: cutoff },
  }).lean();

export const listProcessingIyzicoPaymentsLean = async (cutoff?: Date) => {
  const filter: Record<string, unknown> = {
    status: 'processing',
    provider: 'iyzico',
  };

  if (cutoff) {
    filter.updatedAt = { $lt: cutoff };
  }

  return Payment.find(filter).lean();
};

export const failStalePendingPayments = async (orderIds: string[], cutoff: Date) =>
  Payment.updateMany(
    {
      orderId: { $in: orderIds },
      status: 'pending',
      updatedAt: { $lt: cutoff },
    },
    { $set: { status: 'failed', updatedAt: new Date() } }
  );

export const listCompletedIyzicoPaymentsLean = async () =>
  Payment.find({
    status: 'completed',
    provider: 'iyzico',
    externalId: { $ne: null },
  }).lean();

export const listCompletedIyzicoPaymentsForSplitSyncLean = async () =>
  Payment.find({
    status: 'completed',
    provider: 'iyzico',
    externalId: { $ne: null },
  })
    .select('orderId externalId')
    .lean();

export const updatePaymentById = async (paymentId: string, update: Record<string, unknown>) =>
  Payment.findByIdAndUpdate(paymentId, { $set: update });
