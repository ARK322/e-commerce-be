import mongoose from 'mongoose';
import { CommerceError } from '@/shared/errors/commerce-error';
import {
  decrementStockForOrderItems,
  type StockDecrement,
} from '@/domains/commerce/application/orders/order-stock';
import { findOrderByIdWithSession } from '@/domains/commerce/infrastructure/repositories/order.repository';

export const reservePendingOrderStock = async (
  orderId: string,
  items: StockDecrement[]
): Promise<boolean> => {
  const session = await mongoose.startSession();

  try {
    let reserved = false;

    await session.withTransaction(async () => {
      const order = await findOrderByIdWithSession(orderId, session);

      if (!order) {
        throw new CommerceError(404, 'Sipariş bulunamadı');
      }

      if (order.status !== 'pending') {
        throw new CommerceError(409, 'Sipariş ödemeye uygun değil');
      }

      if (order.stockReserved) {
        return;
      }

      await decrementStockForOrderItems(items, session);

      order.stockReserved = true;
      order.stockReservedAt = new Date();
      order.updatedAt = new Date();
      await order.save({ session });
      reserved = true;
    });

    return reserved;
  } finally {
    await session.endSession();
  }
};
