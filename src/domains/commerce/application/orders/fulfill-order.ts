import mongoose from 'mongoose';
import { CommerceError } from '@/shared/errors/commerce-error';
import {
  decrementStockForOrderItems,
  type StockDecrement,
} from '@/domains/commerce/application/orders/order-stock';
import { findPendingOrderByIdWithSession } from '@/domains/commerce/infrastructure/repositories/order.repository';

export const fulfillPaidOrder = async (
  orderId: string,
  items: StockDecrement[]
): Promise<void> => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const order = await findPendingOrderByIdWithSession(orderId, session);

      if (!order) {
        throw new CommerceError(409, 'Sipariş zaten işlendi veya iptal edildi');
      }

      if (!order.stockReserved) {
        await decrementStockForOrderItems(items, session);
      }

      order.status = 'paid';
      order.stockReserved = false;
      order.stockReservedAt = null;
      order.updatedAt = new Date();
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
};
