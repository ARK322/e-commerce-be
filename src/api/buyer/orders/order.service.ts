import type { ItemFulfillmentStatus, OrderStatus } from '@/integrations/mongo';
import { CommerceError } from '@/shared/errors/commerce-error';
import { approvePaymentSplitsForSeller } from '@/domains/payments/application/payment/payment-split';
import { cancelPendingOrder } from '@/domains/commerce/application/orders/cancel-pending-order';
import { createOrderFromCartForBuyer } from '@/domains/commerce/application/orders/create-order-from-cart';
import {
  assertSellerItemStatusTransition,
  computeAggregateOrderStatus,
  computeSellerSubtotal,
} from '@/domains/commerce/application/orders/order-fulfillment';
import type { CreateOrderInput } from '@/api/buyer/orders/create-order.schema';
import type { UpdateOrderStatusInput } from '@/api/buyer/orders/update-order-status.schema';
import {
  findBuyerOrder,
  findOrderByIdLean,
  findSellerOrderForUpdate,
  findSellerOrderLean,
  listBuyerOrdersLean,
  listSellerOrdersLean,
  saveOrderDocument,
} from '@/domains/commerce/infrastructure/repositories/order.repository';
import { failPendingPaymentsByOrderId } from '@/domains/payments/infrastructure/repositories/payment.repository';

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

export const getBuyerOrder = findBuyerOrder;

export const createOrderFromCart = async (
  buyerId: string,
  input: CreateOrderInput = { acceptPriceChanges: false }
) => {
  const createdOrder = await createOrderFromCartForBuyer(buyerId, {
    acceptPriceChanges: input.acceptPriceChanges,
  });

  return toOrderResponse(createdOrder as OrderRecord);
};

export const listBuyerOrders = async (buyerId: string) => {
  const orders = await listBuyerOrdersLean(buyerId);

  return orders.map((order) => toOrderResponse(order as OrderRecord));
};

export const getBuyerOrderById = async (buyerId: string, orderId: string) => {
  const order = await getBuyerOrder(buyerId, orderId);

  return toOrderResponse(order as OrderRecord);
};

export const listSellerOrders = async (sellerId: string) => {
  const orders = await listSellerOrdersLean(sellerId);

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
  const order = await findSellerOrderLean(sellerId, orderId);
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
  const order = await findSellerOrderForUpdate(sellerId, orderId);

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
    sellerItemsUpdated = true;
  }

  if (!sellerItemsUpdated) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  for (const item of order.items) {
    if (item.sellerId !== sellerId) {
      continue;
    }

    item.fulfillmentStatus = input.status;
  }

  order.status = computeAggregateOrderStatus(order.items);
  await saveOrderDocument(order);

  if (input.status === 'delivered') {
    await approvePaymentSplitsForSeller(orderId, sellerId);
  }

  return toOrderResponse(order.toObject() as OrderRecord);
};

export const cancelBuyerPendingOrder = async (buyerId: string, orderId: string) => {
  const order = await findBuyerOrder(buyerId, orderId);

  if (order.status !== 'pending') {
    throw new CommerceError(400, 'Yalnızca bekleyen sipariş iptal edilebilir');
  }

  const cancelled = await cancelPendingOrder(orderId);

  if (!cancelled) {
    throw new CommerceError(400, 'Sipariş iptal edilemedi');
  }

  await failPendingPaymentsByOrderId(orderId);

  const updatedOrder = await findOrderByIdLean(orderId);

  return toOrderResponse(updatedOrder as OrderRecord);
};
