import type { ItemFulfillmentStatus } from '@/infrastructure/mongo';
import { CommerceError } from '@/shared/errors/commerce-error';
import { approvePaymentSplitsForSeller } from '@/domain/payment/payment-split';
import { enqueueOutboxEvent, OUTBOX_EVENT_TYPES } from '@/domain/notification/outbox/enqueue-outbox-event';
import {
  assertSellerItemStatusTransition,
  computeAggregateOrderStatus,
} from '@/domain/orders/order-fulfillment';
import { findBuyerPaymentProfileLean } from '@/repositories/buyers/buyer.repository';
import {
  findSellerOrderForUpdate,
  saveOrderDocument,
} from '@/repositories/buyers/order.repository';

export type UpdateOrderItemStatusInput = {
  status: 'shipped' | 'delivered';
};

export const updateSellerOrderItemStatus = async (
  sellerId: string,
  orderId: string,
  productId: string,
  input: UpdateOrderItemStatusInput
) => {
  const order = await findSellerOrderForUpdate(sellerId, orderId);

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  if (order.status !== 'paid' && order.status !== 'shipped') {
    throw new CommerceError(400, 'Sipariş bu durumda güncellenemez');
  }

  const item = order.items.find(
    (entry) => entry.sellerId === sellerId && entry.productId === productId
  );

  if (!item) {
    throw new CommerceError(404, 'Sipariş kalemi bulunamadı');
  }

  const currentStatus = (item.fulfillmentStatus ?? 'pending') as ItemFulfillmentStatus;
  assertSellerItemStatusTransition(currentStatus, input.status);
  item.fulfillmentStatus = input.status;

  const previousOrderStatus = order.status as string;
  order.status = computeAggregateOrderStatus(order.items);
  await saveOrderDocument(order);

  if (input.status === 'delivered') {
    await approvePaymentSplitsForSeller(orderId, sellerId);
  }

  const shouldNotifyDelivered =
    input.status === 'delivered' &&
    previousOrderStatus !== 'delivered' &&
    order.status === 'delivered';

  if (shouldNotifyDelivered) {
    const profile = await findBuyerPaymentProfileLean(order.buyerId);
    const email = profile.user?.email;

    if (email) {
      await enqueueOutboxEvent(OUTBOX_EVENT_TYPES.EMAIL_ORDER_DELIVERED, {
        email,
        orderId,
      });
    }
  }

  return order.toObject();
};

export const updateSellerOrderStatusBulk = async (
  sellerId: string,
  orderId: string,
  input: UpdateOrderItemStatusInput
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

  const previousOrderStatus = order.status as string;
  order.status = computeAggregateOrderStatus(order.items);
  await saveOrderDocument(order);

  if (input.status === 'delivered') {
    await approvePaymentSplitsForSeller(orderId, sellerId);
  }

  if (
    input.status === 'delivered' &&
    previousOrderStatus !== 'delivered' &&
    order.status === 'delivered'
  ) {
    const profile = await findBuyerPaymentProfileLean(order.buyerId);
    const email = profile.user?.email;

    if (email) {
      await enqueueOutboxEvent(OUTBOX_EVENT_TYPES.EMAIL_ORDER_DELIVERED, {
        email,
        orderId,
      });
    }
  }

  return order.toObject();
};
