import { PaymentSplit } from '@/infrastructure/mongo';

export const upsertPaymentSplit = async (
  orderId: string,
  productId: string,
  set: Record<string, unknown>,
  setOnInsert: Record<string, unknown>
) =>
  PaymentSplit.findOneAndUpdate(
    { orderId, productId },
    { $set: set, $setOnInsert: setOnInsert },
    { upsert: true, new: true }
  );

export const updatePaymentSplitTransactionId = async (
  orderId: string,
  productId: string,
  paymentTransactionId: string
) =>
  PaymentSplit.findOneAndUpdate(
    { orderId, productId },
    {
      $set: {
        paymentTransactionId,
        updatedAt: new Date(),
      },
    }
  );

export const findPendingPaymentSplitsForSeller = async (orderId: string, sellerId: string) =>
  PaymentSplit.find({
    orderId,
    sellerId,
    approvalStatus: { $in: ['pending', 'failed'] },
    paymentTransactionId: { $ne: null },
  });

export const resetFailedPaymentSplitsToPending = async (orderId: string, sellerId: string) =>
  PaymentSplit.updateMany(
    {
      orderId,
      sellerId,
      approvalStatus: 'failed',
      paymentTransactionId: { $ne: null },
    },
    {
      $set: {
        approvalStatus: 'pending',
        updatedAt: new Date(),
      },
    }
  );

export const listRetryablePaymentSplitGroupsLean = async () =>
  PaymentSplit.aggregate<{ orderId: string; sellerId: string }>([
    {
      $match: {
        approvalStatus: { $in: ['pending', 'failed'] },
        paymentTransactionId: { $ne: null },
      },
    },
    {
      $group: {
        _id: { orderId: '$orderId', sellerId: '$sellerId' },
      },
    },
    {
      $project: {
        _id: 0,
        orderId: '$_id.orderId',
        sellerId: '$_id.sellerId',
      },
    },
  ]);

export const findPendingPaymentSplitsForOrder = async (orderId: string) =>
  PaymentSplit.find({
    orderId,
    approvalStatus: 'pending',
    paymentTransactionId: { $ne: null },
  });

export const savePaymentSplitDocument = async (split: { save: () => Promise<unknown> }) =>
  split.save();

export const findPaymentSplitsByOrderIdLean = async (orderId: string) =>
  PaymentSplit.find({ orderId }).lean();

export const listApprovedPaymentSplitsLean = async (limit = 50) =>
  PaymentSplit.find({ approvalStatus: 'approved' }).sort({ updatedAt: 1 }).limit(limit).lean();

export const paymentSplitWithNullTransactionExists = async (orderId: string) =>
  PaymentSplit.exists({
    orderId,
    paymentTransactionId: null,
  });

export const findPaymentSplitByOrderAndProduct = async (orderId: string, productId: string) =>
  PaymentSplit.findOne({ orderId, productId });
