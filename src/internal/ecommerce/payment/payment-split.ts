import { PaymentSplit, Seller } from '@/integrations/mongo';
import { createUserId } from '@/internal/ids';
import { calcItemSplit } from '@/internal/ecommerce/payment/commission';
import { EcommerceError } from '@/internal/ecommerce/errors';
import { approveIyzicoPaymentItem } from '@/integrations/iyzico/approve-payment-item';
import type { InitializeCheckoutItem } from '@/integrations/iyzico/types';

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
  const sellerIds = [...new Set(items.map((item) => item.sellerId))];
  const sellers = await Seller.find({ _id: { $in: sellerIds } })
    .select('_id iyzicoSubMerchantKey approvalStatus')
    .lean();

  const sellersById = new Map(sellers.map((seller) => [String(seller._id), seller]));

  const prepared = items.map((item) => {
    const seller = sellersById.get(item.sellerId);

    if (!seller || seller.approvalStatus !== 'approved') {
      throw new EcommerceError(400, 'Sepette onaylı olmayan satıcı ürünü var');
    }

    if (!seller.iyzicoSubMerchantKey) {
      throw new EcommerceError(
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
      PaymentSplit.findOneAndUpdate(
        { orderId, productId: split.productId },
        {
          $set: {
            sellerId: split.sellerId,
            subtotal: split.subtotal,
            commissionAmount: split.commissionAmount,
            sellerShare: split.sellerShare,
            approvalStatus: 'pending',
            updatedAt: new Date(),
          },
          $setOnInsert: {
            _id: createUserId(),
            orderId,
            productId: split.productId,
            paymentTransactionId: null,
            approvedAt: null,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
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
      PaymentSplit.findOneAndUpdate(
        { orderId, productId: transaction.itemId },
        {
          $set: {
            paymentTransactionId: transaction.paymentTransactionId,
            updatedAt: new Date(),
          },
        }
      )
    )
  );
};

export const approvePaymentSplitsForOrder = async (orderId: string) => {
  const splits = await PaymentSplit.find({
    orderId,
    approvalStatus: 'pending',
    paymentTransactionId: { $ne: null },
  });

  for (const split of splits) {
    if (!split.paymentTransactionId) {
      continue;
    }

    try {
      await approveIyzicoPaymentItem(split.paymentTransactionId, orderId);
      split.approvalStatus = 'approved';
      split.approvedAt = new Date();
      split.updatedAt = new Date();
      await split.save();
    } catch (error) {
      split.approvalStatus = 'failed';
      split.updatedAt = new Date();
      await split.save();
      throw error;
    }
  }
};
