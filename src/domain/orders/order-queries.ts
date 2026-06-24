import { CommerceError } from '@/shared/errors/commerce-error';
import { cancelPendingOrder } from '@/domain/orders/cancel-pending-order';
import { createOrderFromCartForBuyer } from '@/domain/orders/create-order-from-cart';
import { computeSellerSubtotal } from '@/domain/orders/order-fulfillment';
import { toOrderResponse, type OrderRecord } from '@/domain/orders/order-response';
import {
  createSellerShipment,
  listOrderShipments,
  listSellerOrderShipments,
  type CreateShipmentInput,
} from '@/domain/orders/shipment';
import {
  updateSellerOrderItemStatus,
  updateSellerOrderStatusBulk,
  type UpdateOrderItemStatusInput,
} from '@/domain/orders/update-fulfillment';
import {
  findBuyerOrder,
  findOrderByIdLean,
  findSellerOrderLean,
  listBuyerOrdersLean,
  listSellerOrdersLean,
} from '@/repositories/buyers/order.repository';
import { failPendingPaymentsByOrderId } from '@/repositories/buyers/payment.repository';

export const getBuyerOrder = async (buyerId: string, orderId: string) => {
  const order = await findBuyerOrder(buyerId, orderId);

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  return order;
};

export const createOrderFromCartResponse = async (
  buyerId: string,
  input: { acceptPriceChanges?: boolean; addressId?: string } = {}
) => {
  const createdOrder = await createOrderFromCartForBuyer(buyerId, {
    acceptPriceChanges: input.acceptPriceChanges ?? false,
    addressId: input.addressId,
  });

  return toOrderResponse(createdOrder as OrderRecord);
};

export const listBuyerOrdersResponse = async (buyerId: string) => {
  const orders = await listBuyerOrdersLean(buyerId);
  return orders.map((order) => toOrderResponse(order as OrderRecord));
};

export const getBuyerOrderByIdWithShipments = async (buyerId: string, orderId: string) => {
  const order = await getBuyerOrder(buyerId, orderId);
  const shipments = await listOrderShipments(orderId);

  return {
    ...toOrderResponse(order as OrderRecord),
    shipments,
  };
};

export const listSellerOrdersResponse = async (sellerId: string) => {
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

export const getSellerOrderByIdWithShipments = async (sellerId: string, orderId: string) => {
  const order = await findSellerOrderLean(sellerId, orderId);

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  const sellerItems = order.items.filter((item) => item.sellerId === sellerId);
  const shipments = await listSellerOrderShipments(orderId, sellerId);

  return {
    ...toOrderResponse(order as OrderRecord),
    items: sellerItems,
    totalAmount: computeSellerSubtotal(order.items, sellerId),
    shipments,
  };
};

export const updateOrderStatusResponse = async (
  sellerId: string,
  orderId: string,
  input: UpdateOrderItemStatusInput
) => {
  const order = await updateSellerOrderStatusBulk(sellerId, orderId, input);
  return toOrderResponse(order as OrderRecord);
};

export const updateOrderItemStatusResponse = async (
  sellerId: string,
  orderId: string,
  productId: string,
  input: UpdateOrderItemStatusInput
) => {
  const order = await updateSellerOrderItemStatus(sellerId, orderId, productId, input);
  return toOrderResponse(order as OrderRecord);
};

export const createOrderShipment = async (
  sellerId: string,
  orderId: string,
  input: CreateShipmentInput
) => createSellerShipment(sellerId, orderId, input);

export const cancelBuyerPendingOrderResponse = async (buyerId: string, orderId: string) => {
  const order = await getBuyerOrder(buyerId, orderId);

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
