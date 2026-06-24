import type { ShipmentCarrier } from '@/infrastructure/mongo';
import { CommerceError } from '@/shared/errors/commerce-error';
import { createUserId } from '@/shared/ids';
import { enqueueOutboxEvent, OUTBOX_EVENT_TYPES } from '@/domain/notification/outbox/enqueue-outbox-event';
import { findBuyerPaymentProfileLean } from '@/repositories/buyers/buyer.repository';
import { findOrderByIdLean } from '@/repositories/buyers/order.repository';
import {
  createShipment,
  listShipmentsByOrderAndSellerLean,
  listShipmentsByOrderIdLean,
} from '@/repositories/orders/shipment.repository';

export type CreateShipmentInput = {
  trackingNumber: string;
  carrier: ShipmentCarrier;
  productIds?: string[];
  notes?: string;
};

const toShipmentResponse = (shipment: {
  _id: unknown;
  orderId: string;
  sellerId: string;
  productIds: string[];
  trackingNumber: string;
  carrier: string;
  status: string;
  notes?: string | null;
  shippedAt?: Date;
  deliveredAt?: Date | null;
  createdAt?: Date;
}) => ({
  id: String(shipment._id),
  orderId: shipment.orderId,
  sellerId: shipment.sellerId,
  productIds: shipment.productIds,
  trackingNumber: shipment.trackingNumber,
  carrier: shipment.carrier,
  status: shipment.status,
  notes: shipment.notes ?? null,
  shippedAt: shipment.shippedAt,
  deliveredAt: shipment.deliveredAt ?? null,
  createdAt: shipment.createdAt,
});

export const listOrderShipments = async (orderId: string) => {
  const shipments = await listShipmentsByOrderIdLean(orderId);
  return shipments.map((shipment) => toShipmentResponse(shipment));
};

export const listSellerOrderShipments = async (orderId: string, sellerId: string) => {
  const shipments = await listShipmentsByOrderAndSellerLean(orderId, sellerId);
  return shipments.map((shipment) => toShipmentResponse(shipment));
};

export const createSellerShipment = async (
  sellerId: string,
  orderId: string,
  input: CreateShipmentInput
) => {
  const order = await findOrderByIdLean(orderId);

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  if (order.status !== 'paid' && order.status !== 'shipped') {
    throw new CommerceError(400, 'Kargo bilgisi yalnızca ödenmiş siparişlere eklenebilir');
  }

  const sellerItems = order.items.filter((item) => item.sellerId === sellerId);

  if (sellerItems.length === 0) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  const defaultProductIds = sellerItems.map((item) => item.productId);
  const productIds = input.productIds?.length ? input.productIds : defaultProductIds;

  const sellerProductIdSet = new Set(defaultProductIds);
  const invalid = productIds.filter((id) => !sellerProductIdSet.has(id));

  if (invalid.length > 0) {
    throw new CommerceError(400, 'Geçersiz ürün kalemi');
  }

  const shipment = await createShipment({
    _id: createUserId(),
    orderId,
    sellerId,
    productIds,
    trackingNumber: input.trackingNumber.trim(),
    carrier: input.carrier,
    notes: input.notes ?? null,
  });

  const profile = await findBuyerPaymentProfileLean(order.buyerId);
  const email = profile.user?.email;

  if (email) {
    await enqueueOutboxEvent(OUTBOX_EVENT_TYPES.EMAIL_ORDER_SHIPPED, {
      email,
      orderId,
      trackingNumber: input.trackingNumber,
      carrier: input.carrier,
    });
  }

  return toShipmentResponse({
    _id: shipment._id,
    orderId: shipment.orderId,
    sellerId: shipment.sellerId,
    productIds: shipment.productIds,
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    status: shipment.status,
    notes: shipment.notes,
    shippedAt: shipment.shippedAt,
    deliveredAt: shipment.deliveredAt,
    createdAt: shipment.createdAt,
  });
};
