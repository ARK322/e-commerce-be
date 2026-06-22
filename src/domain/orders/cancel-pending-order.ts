import mongoose from 'mongoose';
import { incrementStockForOrderItems } from '@/domain/orders/order-stock';
import { restoreCartFromOrder } from '@/domain/orders/restore-cart-from-order';
import { findPendingOrderByIdWithSession } from '@/repositories/buyers/order.repository';

export const cancelPendingOrder = async (orderId: string): Promise<boolean> => {
  const session = await mongoose.startSession();

  try {
    let cancelled = false;

    await session.withTransaction(async () => {
      const order = await findPendingOrderByIdWithSession(orderId, session);

      if (!order) {
        return;
      }

      if (order.stockReserved) {
        await incrementStockForOrderItems(
          order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          session
        );
      }

      order.status = 'cancelled';
      order.stockReserved = false;
      order.stockReservedAt = null;
      order.updatedAt = new Date();
      await order.save({ session });
      cancelled = true;
    });

    if (cancelled) {
      await restoreCartFromOrder(orderId);
    }

    return cancelled;
  } finally {
    await session.endSession();
  }
};
