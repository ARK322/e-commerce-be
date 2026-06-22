import { PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import { assertPermission } from '@/domains/identity/application/access/admin/permissions';
import type { AdminAccessContext } from '@/domains/identity/application/queries/admin-context';
import { CommerceError } from '@/shared/errors/commerce-error';
import type { ListAdminOrdersQuery } from '@/api/admin/orders/list-orders.schema';
import {
  findOrderByIdLean,
  listAdminOrdersLean,
} from '@/domains/commerce/infrastructure/repositories/order.repository';
import { findPaymentByOrderIdLean } from '@/domains/payments/infrastructure/repositories/payment.repository';

type OrderItemRecord = {
  productId: string;
  sellerId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  fulfillmentStatus?: string;
};

type OrderRecord = {
  _id: unknown;
  buyerId: string;
  items: OrderItemRecord[];
  totalAmount: number;
  currency: string;
  status: string;
  shippingAddress: Record<string, string>;
  createdAt?: Date;
  updatedAt?: Date;
};

const toOrderSummary = (order: OrderRecord) => ({
  id: String(order._id),
  buyerId: order.buyerId,
  sellerIds: [...new Set(order.items.map((item) => item.sellerId))],
  itemCount: order.items.length,
  totalAmount: order.totalAmount,
  currency: order.currency,
  status: order.status,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

const toOrderDetail = (order: OrderRecord) => ({
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

const toPaymentSummary = (payment: {
  _id: unknown;
  status: string;
  amount: number;
  currency: string;
  provider?: string | null;
  externalId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
} | null) => {
  if (!payment) {
    return null;
  }

  return {
    id: String(payment._id),
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    provider: payment.provider ?? null,
    externalId: payment.externalId ?? null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
};

export const listAdminOrders = async (ctx: AdminAccessContext, query: ListAdminOrdersQuery) => {
  assertPermission(ctx, PERMISSIONS.ORDERS_READ, 'Siparişleri görüntüleme yetkin yok');

  const { items, total } = await listAdminOrdersLean(
    {
      status: query.status,
      buyerId: query.buyerId,
      sellerId: query.sellerId,
    },
    query.limit,
    query.offset
  );

  return {
    items: items.map((order) => toOrderSummary(order as OrderRecord)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
};

export const getAdminOrderById = async (ctx: AdminAccessContext, orderId: string) => {
  assertPermission(ctx, PERMISSIONS.ORDERS_READ, 'Siparişleri görüntüleme yetkin yok');

  const order = await findOrderByIdLean(orderId);

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  const payment = await findPaymentByOrderIdLean(orderId);

  return {
    order: toOrderDetail(order as OrderRecord),
    payment: toPaymentSummary(payment),
  };
};
