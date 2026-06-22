import type { ClientSession } from 'mongoose';
import type { OrderCurrency, OrderStatus } from '@/infrastructure/mongo';
import { Order } from '@/infrastructure/mongo';
import { CommerceError } from '@/shared/errors/commerce-error';

type CreateOrderData = {
  items: Array<{
    productId: string;
    sellerId: string;
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
    fulfillmentStatus?: 'pending' | 'shipped' | 'delivered';
  }>;
  shippingAddress: {
    firstName: string;
    lastName: string;
    phone: string;
    country: string;
    city: string;
    address: string;
  };
  _id: string;
  buyerId: string;
  totalAmount: number;
  currency: OrderCurrency;
  status: OrderStatus;
};

export const findBuyerOrder = async (buyerId: string, orderId: string) => {
  const order = await Order.findOne({ _id: orderId, buyerId }).lean();

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  return order;
};

export const findSellerOrderLean = async (sellerId: string, orderId: string) => {
  const order = await Order.findOne({
    _id: orderId,
    'items.sellerId': sellerId,
  }).lean();

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  return order;
};

export const findSellerOrderForUpdate = async (sellerId: string, orderId: string) =>
  Order.findOne({
    _id: orderId,
    'items.sellerId': sellerId,
  });

export const findOrderByIdLean = async (orderId: string) => Order.findById(orderId).lean();

export const listBuyerOrdersLean = async (buyerId: string) =>
  Order.find({ buyerId }).sort({ createdAt: -1 }).lean();

export const listSellerOrdersLean = async (sellerId: string) =>
  Order.find({ 'items.sellerId': sellerId }).sort({ createdAt: -1 }).lean();

export const createOrderInSession = async (data: CreateOrderData, session: ClientSession) => {
  const [order] = await Order.create([data], { session });
  return order;
};

export const saveOrderDocument = async (order: {
  updatedAt?: Date;
  save: (options?: { session?: ClientSession }) => Promise<unknown>;
}) => {
  order.updatedAt = new Date();
  await order.save();
};

export const findPendingOrderByIdWithSession = async (orderId: string, session: ClientSession) =>
  Order.findOne({ _id: orderId, status: 'pending' }).session(session);

export const findOrderByIdWithSession = async (orderId: string, session: ClientSession) =>
  Order.findById(orderId).session(session);

export const findExpiringPendingOrdersLean = async (
  cutoff: Date,
  excludeOrderIds: string[]
) =>
  Order.find({
    status: 'pending',
    createdAt: { $lt: cutoff },
    _id: { $nin: excludeOrderIds },
  })
    .select('_id')
    .lean();

export type ListAdminOrdersFilters = {
  status?: OrderStatus;
  buyerId?: string;
  sellerId?: string;
};

export const listAdminOrdersLean = async (
  filters: ListAdminOrdersFilters,
  limit: number,
  offset: number
) => {
  const query: Record<string, unknown> = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.buyerId) {
    query.buyerId = filters.buyerId;
  }

  if (filters.sellerId) {
    query['items.sellerId'] = filters.sellerId;
  }

  const [items, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    Order.countDocuments(query),
  ]);

  return { items, total };
};
