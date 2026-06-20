import mongoose from 'mongoose';
import { Buyer, Cart, Order, Product, type ItemFulfillmentStatus, type OrderStatus } from '@/integrations/mongo';
import { createUserId } from '@/internal/common/ids';
import { CommerceError } from '@/internal/common/errors/commerce-error';
import { approvePaymentSplitsForSeller } from '@/internal/buyers/payment/payment-split';
import {
  assertProductStockAvailable,
  assertSellersReadyForOrder,
  resolveOrderUnitPrice,
} from '@/internal/buyers/orders/order-item-validation';
import {
  assertSellerItemStatusTransition,
  computeAggregateOrderStatus,
  computeSellerSubtotal,
} from '@/internal/buyers/orders/order-fulfillment';
import type { UpdateOrderStatusInput } from '@/features/buyers/orders/update-order-status.schema';
import { findBuyerOrder } from '@/repositories/buyers/order.repository';

type OrderItemRecord = {
  productId: string;
  sellerId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  fulfillmentStatus?: ItemFulfillmentStatus;
};

type ShippingAddressRecord = {
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  city: string;
  address: string;
};

type OrderRecord = {
  _id: unknown;
  buyerId: string;
  items: OrderItemRecord[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  shippingAddress: ShippingAddressRecord;
  createdAt?: Date;
  updatedAt?: Date;
};

const toOrderResponse = (order: OrderRecord) => ({
  id: String(order._id),
  buyerId: order.buyerId,
  items: order.items,
  totalAmount: order.totalAmount,
  currency: order.currency,
  status: order.status,
  shippingAddress: order.shippingAddress,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

const buildShippingAddress = async (buyerId: string): Promise<ShippingAddressRecord> => {
  const buyer = await Buyer.findById(buyerId).lean();

  if (
    !buyer?.firstName ||
    !buyer.lastName ||
    !buyer.phone ||
    !buyer.country ||
    !buyer.city ||
    !buyer.deliveryAddress
  ) {
    throw new CommerceError(400, 'Sipariş için teslimat profili eksik');
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

export const getBuyerOrder = findBuyerOrder;

const getSellerOrder = async (sellerId: string, orderId: string) => {
  const order = await Order.findOne({
    _id: orderId,
    'items.sellerId': sellerId,
  }).lean();

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  return order;
};

const buildOrderItemsFromCart = async (
  cartItems: Array<{ productId: string; quantity: number; priceSnapshot?: number | null }>
) => {
  const orderItems: OrderItemRecord[] = [];

  for (const item of cartItems) {
    const product = await Product.findOne({
      _id: item.productId,
      isActive: true,
      categoryId: { $ne: null },
    }).lean();

    if (!product) {
      throw new CommerceError(400, 'Sepette geçersiz ürün var');
    }

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

export const createOrderFromCart = async (buyerId: string) => {
  const shippingAddress = await buildShippingAddress(buyerId);
  const orderId = createUserId();
  const session = await mongoose.startSession();

  try {
    let createdOrder: OrderRecord | null = null;

    await session.withTransaction(async () => {
      const cart = await Cart.findOneAndUpdate(
        { _id: buyerId, 'items.0': { $exists: true } },
        { $set: { items: [], updatedAt: new Date() } },
        { session, returnDocument: 'before' }
      );

      if (!cart?.items?.length) {
        throw new CommerceError(400, 'Sepet boş');
      }

      const orderItems = await buildOrderItemsFromCart(cart.items);
      const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

      const [order] = await Order.create(
        [
          {
            _id: orderId,
            buyerId,
            items: orderItems,
            totalAmount,
            currency: 'TRY',
            status: 'pending',
            shippingAddress,
          },
        ],
        { session }
      );

      createdOrder = order.toObject() as OrderRecord;
    });

    if (!createdOrder) {
      throw new CommerceError(500, 'Sipariş oluşturulamadı');
    }

    return toOrderResponse(createdOrder);
  } finally {
    await session.endSession();
  }
};

export const listBuyerOrders = async (buyerId: string) => {
  const orders = await Order.find({ buyerId }).sort({ createdAt: -1 }).lean();

  return orders.map((order) => toOrderResponse(order as OrderRecord));
};

export const getBuyerOrderById = async (buyerId: string, orderId: string) => {
  const order = await getBuyerOrder(buyerId, orderId);

  return toOrderResponse(order as OrderRecord);
};

export const listSellerOrders = async (sellerId: string) => {
  const orders = await Order.find({ 'items.sellerId': sellerId })
    .sort({ createdAt: -1 })
    .lean();

  return orders.map((order) => {
    const sellerItems = order.items.filter((item) => item.sellerId === sellerId);

    return {
      ...toOrderResponse(order as OrderRecord),
      items: sellerItems,
      totalAmount: computeSellerSubtotal(order.items, sellerId),
    };
  });
};

export const getSellerOrderById = async (sellerId: string, orderId: string) => {
  const order = await getSellerOrder(sellerId, orderId);
  const sellerItems = order.items.filter((item) => item.sellerId === sellerId);

  return {
    ...toOrderResponse(order as OrderRecord),
    items: sellerItems,
    totalAmount: computeSellerSubtotal(order.items, sellerId),
  };
};

export const updateOrderStatus = async (
  sellerId: string,
  orderId: string,
  input: UpdateOrderStatusInput
) => {
  const order = await Order.findOne({
    _id: orderId,
    'items.sellerId': sellerId,
  });

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  if (order.status !== 'paid' && order.status !== 'shipped') {
    throw new CommerceError(400, 'Sipariş bu durumda güncellenemez');
  }

  let sellerItemsUpdated = false;

  for (const item of order.items) {
    if (item.sellerId !== sellerId) {
      continue;
    }

    const currentStatus = (item.fulfillmentStatus ?? 'pending') as ItemFulfillmentStatus;
    assertSellerItemStatusTransition(currentStatus, input.status);
    item.fulfillmentStatus = input.status;
    sellerItemsUpdated = true;
  }

  if (!sellerItemsUpdated) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  order.status = computeAggregateOrderStatus(order.items);
  order.updatedAt = new Date();
  await order.save();

  if (input.status === 'delivered') {
    await approvePaymentSplitsForSeller(orderId, sellerId);
  }

  return toOrderResponse(order.toObject() as OrderRecord);
};
