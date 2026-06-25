import { createUserId } from '@/shared/ids';
import { createLogger } from '@/shared/logging';
import { isDuplicateKeyError } from '@/domain/auth/errors';
import {
  findPaymentSplitByOrderAndProduct,
  savePaymentSplitDocument,
} from '@/repositories/buyers/payment-split.repository';
import {
  clawBackSellerWalletForReturn,
  createSellerWalletLedgerEntry,
  findSellerWalletLedgerEntry,
} from '@/repositories/sellers/seller-wallet.repository';

const log = createLogger({ module: 'return-settlement' });

const roundMoney = (value: number) => Math.round(value * 100) / 100;

type OrderItemForSettlement = {
  productId: string;
  quantity: number;
};

type ReturnItemForSettlement = {
  productId: string;
  quantity: number;
};

export const reverseSettlementForReturn = async (
  orderId: string,
  orderItems: OrderItemForSettlement[],
  returnItems: ReturnItemForSettlement[]
): Promise<void> => {
  for (const returnItem of returnItems) {
    const orderItem = orderItems.find((entry) => entry.productId === returnItem.productId);

    if (!orderItem) {
      continue;
    }

    const split = await findPaymentSplitByOrderAndProduct(orderId, returnItem.productId);

    if (!split || split.approvalStatus === 'reversed') {
      continue;
    }

    const proportion = Math.min(1, returnItem.quantity / orderItem.quantity);
    const reverseSellerShare = roundMoney(split.sellerShare * proportion);
    const reverseCommission = roundMoney(split.commissionAmount * proportion);

    if (reverseSellerShare <= 0) {
      continue;
    }

    const ledgerKey = `${String(split._id)}:${returnItem.quantity}`;
    const existing = await findSellerWalletLedgerEntry(ledgerKey, 'return_reversal');

    if (existing) {
      continue;
    }

    try {
      await createSellerWalletLedgerEntry({
        _id: createUserId(),
        sellerId: String(split.sellerId),
        orderId,
        paymentSplitId: ledgerKey,
        entryType: 'return_reversal',
        amount: reverseSellerShare,
      });
      await clawBackSellerWalletForReturn(String(split.sellerId), reverseSellerShare);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        continue;
      }

      log.error(
        { err: error, orderId, productId: returnItem.productId, sellerId: split.sellerId },
        'İade sonrası satıcı cüzdan düzeltmesi başarısız'
      );
      throw error;
    }

    split.reversedSellerShare = roundMoney((split.reversedSellerShare ?? 0) + reverseSellerShare);
    split.reversedCommissionAmount = roundMoney(
      (split.reversedCommissionAmount ?? 0) + reverseCommission
    );
    split.updatedAt = new Date();

    if (split.reversedSellerShare >= split.sellerShare - 0.001) {
      split.approvalStatus = 'reversed';
    }

    await savePaymentSplitDocument(split);
  }
};
