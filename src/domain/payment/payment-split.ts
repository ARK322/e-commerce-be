import { createUserId } from '@/shared/ids';
import { calcItemSplit } from '@/domain/payment/commission';
import { CommerceError } from '@/shared/errors/commerce-error';
import { assertSellersReadyForOrder } from '@/domain/orders/order-item-validation';
import { approveIyzicoPaymentItem } from '@/infrastructure/iyzico/approve-payment-item';
import { releaseSellerAvailableFromSplit } from '@/domain/sellers/wallet/release-available-from-split';
import { enqueueOpsAlert } from '@/shared/outbox/ops-alert';
import { OUTBOX_EVENT_TYPES } from '@/shared/outbox/enqueue-outbox-event';
import type { InitializeCheckoutItem } from '@/infrastructure/iyzico/types';
import {
  findPendingPaymentSplitsForOrder,
  findPendingPaymentSplitsForSeller,
  savePaymentSplitDocument,
  updatePaymentSplitTransactionId,
  upsertPaymentSplit,
} from '@/repositories/buyers/payment-split.repository';
import { findSellersByIdsLean } from '@/repositories/sellers/seller.repository';

type OrderItemForSplit = {
  productId: string;
  sellerId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};

export type PreparedPaymentSplit = {
  productId: string;
  sellerId: string;
  subtotal: number;
  commissionAmount: number;
  sellerShare: number;
  checkoutItem: InitializeCheckoutItem;
};

export const buildPaymentSplitsForOrder = async (
  orderId: string,
  items: OrderItemForSplit[]
): Promise<PreparedPaymentSplit[]> => {
  await assertSellersReadyForOrder(items);

  const sellerIds = [...new Set(items.map((item) => item.sellerId))];
  const sellers = await findSellersByIdsLean(sellerIds, '_id iyzicoSubMerchantKey approvalStatus');

  const sellersById = new Map(sellers.map((seller) => [String(seller._id), seller]));

  const prepared = items.map((item) => {
    const seller = sellersById.get(item.sellerId);

    if (!seller?.iyzicoSubMerchantKey) {
      throw new CommerceError(
        400,
        'Satıcı ödeme alt üye kaydı tamamlanmamış; ödeme başlatılamaz'
      );
    }

    const amounts = calcItemSplit(item.subtotal);

    return {
      productId: item.productId,
      sellerId: item.sellerId,
      subtotal: amounts.subtotal,
      commissionAmount: amounts.commissionAmount,
      sellerShare: amounts.sellerShare,
      checkoutItem: {
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        subMerchantKey: seller.iyzicoSubMerchantKey,
        subMerchantPrice: amounts.sellerShare,
      },
    };
  });

  await Promise.all(
    prepared.map((split) =>
      upsertPaymentSplit(
        orderId,
        split.productId,
        {
          sellerId: split.sellerId,
          subtotal: split.subtotal,
          commissionAmount: split.commissionAmount,
          sellerShare: split.sellerShare,
          approvalStatus: 'pending',
          updatedAt: new Date(),
        },
        {
          _id: createUserId(),
          orderId,
          productId: split.productId,
          paymentTransactionId: null,
          approvedAt: null,
          createdAt: new Date(),
        }
      )
    )
  );

  return prepared;
};

export const syncPaymentSplitTransactionIds = async (
  orderId: string,
  itemTransactions: Array<{ itemId: string; paymentTransactionId: string }>
) => {
  await Promise.all(
    itemTransactions.map((transaction) =>
      updatePaymentSplitTransactionId(
        orderId,
        transaction.itemId,
        transaction.paymentTransactionId
      )
    )
  );
};

export const approvePaymentSplitsForSeller = async (orderId: string, sellerId: string) => {
  const splits = await findPendingPaymentSplitsForSeller(orderId, sellerId);

  for (const split of splits) {
    if (!split.paymentTransactionId) {
      continue;
    }

    try {
      await approveIyzicoPaymentItem(split.paymentTransactionId, orderId);
      split.approvalStatus = 'approved';
      split.approvedAt = new Date();
      split.updatedAt = new Date();
      await savePaymentSplitDocument(split);
      await releaseSellerAvailableFromSplit(split);
    } catch (error) {
      split.approvalStatus = 'failed';
      split.updatedAt = new Date();
      await savePaymentSplitDocument(split);
      await enqueueOpsAlert(OUTBOX_EVENT_TYPES.OPS_PAYMENT_SPLIT_APPROVAL_FAILED, {
        orderId,
        sellerId,
        paymentSplitId: String(split._id),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
};

/** @deprecated Tüm split'leri onaylar — çok satıcılı siparişlerde kullanmayın. */
export const approvePaymentSplitsForOrder = async (orderId: string) => {
  const splits = await findPendingPaymentSplitsForOrder(orderId);

  for (const split of splits) {
    if (!split.paymentTransactionId) {
      continue;
    }

    try {
      await approveIyzicoPaymentItem(split.paymentTransactionId, orderId);
      split.approvalStatus = 'approved';
      split.approvedAt = new Date();
      split.updatedAt = new Date();
      await savePaymentSplitDocument(split);
      await releaseSellerAvailableFromSplit(split);
    } catch (error) {
      split.approvalStatus = 'failed';
      split.updatedAt = new Date();
      await savePaymentSplitDocument(split);
      await enqueueOpsAlert(OUTBOX_EVENT_TYPES.OPS_PAYMENT_SPLIT_APPROVAL_FAILED, {
        orderId,
        sellerId: String(split.sellerId),
        paymentSplitId: String(split._id),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
};
