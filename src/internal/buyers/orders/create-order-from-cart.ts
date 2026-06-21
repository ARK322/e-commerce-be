import mongoose from 'mongoose';
import { createUserId } from '@/internal/common/ids';
import { CommerceError } from '@/internal/common/errors/commerce-error';
import { cancelPendingOrder } from '@/internal/buyers/orders/cancel-pending-order';
import { reservePendingOrderStock } from '@/internal/buyers/orders/reserve-order-stock';
import {
  assertProductStockAvailable,
  assertSellersReadyForOrder,
  resolveOrderUnitPrice,
} from '@/internal/buyers/orders/order-item-validation';
import { assertPurchasableCatalogProduct } from '@/internal/catalog/product/assert-purchasable-product';
import { findBuyerShippingProfileLean } from '@/repositories/buyers/buyer.repository';
import {
  clearNonEmptyCartInSession,
  restoreCartItemsForBuyer,
  type CartItemSnapshot,
} from '@/repositories/buyers/cart.repository';
import { createOrderInSession } from '@/repositories/buyers/order.repository';

type OrderItemRecord = {
  productId: string;
  sellerId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  fulfillmentStatus: 'pending';
};

type ShippingAddressRecord = {
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  city: string;
  address: string;
};

export type CreatedOrderRecord = {
  _id: unknown;
  buyerId: string;
  items: OrderItemRecord[];
  totalAmount: number;
  currency: string;
  status: string;
  shippingAddress: ShippingAddressRecord;
  createdAt?: Date;
  updatedAt?: Date;
};

const buildShippingAddress = async (buyerId: string): Promise<ShippingAddressRecord> => {
  const buyer = await findBuyerShippingProfileLean(buyerId);

  if (
    !buyer?.firstName ||
    !buyer.lastName ||
    !buyer.phone ||
    !buyer.country ||
    !buyer.city ||
    !buyer.deliveryAddress
  ) {
    throw new CommerceError(400, 'Sipariş için profil bilgileri eksik');
  }

  return {
    firstName: buyer.firstName,
    lastName: buyer.lastName,
    phone: buyer.phone,
    country: buyer.country,
    city: buyer.city,
    address: buyer.deliveryAddress,
  };
};

const buildOrderItemsFromCart = async (
  cartItems: Array<{ productId: string; quantity: number; priceSnapshot?: number | null }>
) => {
  const orderItems: OrderItemRecord[] = [];

  for (const item of cartItems) {
    const product = await assertPurchasableCatalogProduct(item.productId);

    assertProductStockAvailable(product, item.quantity);

    const price = resolveOrderUnitPrice(item.priceSnapshot, product.price);

    orderItems.push({
      productId: item.productId,
      sellerId: product.sellerId,
      name: product.name,
      price,
      quantity: item.quantity,
      subtotal: price * item.quantity,
      fulfillmentStatus: 'pending',
    });
  }

  await assertSellersReadyForOrder(orderItems);

  return orderItems;
};

export const createOrderFromCartForBuyer = async (
  buyerId: string
): Promise<CreatedOrderRecord> => {
  const shippingAddress = await buildShippingAddress(buyerId);
  const orderId = createUserId();
  const session = await mongoose.startSession();

  try {
    let createdOrder: CreatedOrderRecord | null = null;
    let clearedCartItems: CartItemSnapshot[] = [];

    await session.withTransaction(async () => {
      const cart = await clearNonEmptyCartInSession(buyerId, session);

      if (!cart?.items?.length) {
        throw new CommerceError(400, 'Sepet boş');
      }

      clearedCartItems = cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        priceSnapshot: item.priceSnapshot ?? null,
      }));

      const orderItems = await buildOrderItemsFromCart(cart.items);
      const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

      const order = await createOrderInSession(
        {
          _id: orderId,
          buyerId,
          items: orderItems,
          totalAmount,
          currency: 'TRY',
          status: 'pending',
          shippingAddress,
        },
        session
      );

      createdOrder = order.toObject() as CreatedOrderRecord;
    });

    if (!createdOrder) {
      throw new CommerceError(500, 'Sipariş oluşturulamadı');
    }

    const orderRecord = createdOrder as CreatedOrderRecord;

    try {
      await reservePendingOrderStock(
        orderId,
        orderRecord.items.map((item: OrderItemRecord) => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
      );
    } catch (error) {
      await cancelPendingOrder(orderId);
      await restoreCartItemsForBuyer(buyerId, clearedCartItems);
      throw error;
    }

    return orderRecord;
  } finally {
    await session.endSession();
  }
};
