import type { ItemFulfillmentStatus, OrderStatus } from '@/infrastructure/mongo';

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

export type OrderRecord = {
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

export const toOrderResponse = (order: OrderRecord) => ({
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
