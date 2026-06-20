import mongoose from 'mongoose';
import { Order } from '@/integrations/mongo';
import { CommerceError } from '@/internal/common/errors/commerce-error';
import {
  decrementStockForOrderItems,
  type StockDecrement,
} from '@/internal/buyers/orders/order-stock';

export const fulfillPaidOrder = async (
  orderId: string,
  items: StockDecrement[]
): Promise<void> => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await decrementStockForOrderItems(items, session);

      const updated = await Order.findOneAndUpdate(
        { _id: orderId, status: 'pending' },
        { $set: { status: 'paid', updatedAt: new Date() } },
        { session }
      );

      if (!updated) {
        throw new CommerceError(409, 'Sipariş zaten işlendi veya iptal edildi');
      }
    });
  } finally {
    await session.endSession();
  }
};
