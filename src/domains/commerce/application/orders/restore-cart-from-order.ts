import { createLogger } from '@/shared/logging';
import { restoreCartItemsForBuyer, type CartItemSnapshot } from '@/domains/commerce/infrastructure/repositories/cart.repository';
import { findOrderByIdLean } from '@/domains/commerce/infrastructure/repositories/order.repository';

const log = createLogger({ module: 'restore-cart' });

const toCartSnapshots = (
  items: Array<{ productId: string; quantity: number; price?: number }>
): CartItemSnapshot[] =>
  items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    priceSnapshot: item.price ?? null,
  }));

export const restoreCartFromOrder = async (orderId: string): Promise<boolean> => {
  const order = await findOrderByIdLean(orderId);

  if (!order?.buyerId || !order.items?.length) {
    return false;
  }

  try {
    await restoreCartItemsForBuyer(
      String(order.buyerId),
      toCartSnapshots(
        order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        }))
      )
    );
    return true;
  } catch (error) {
    log.warn({ err: error, orderId, buyerId: order.buyerId }, 'Sepet geri yüklenemedi');
    return false;
  }
};
