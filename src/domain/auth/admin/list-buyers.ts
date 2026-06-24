import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { assertPermission, canReadBuyers } from '@/domain/auth/access/admin/permissions';
import type { AdminAccessContext } from '@/domain/auth/queries/admin-context';
import { AuthError } from '@/domain/auth/errors';
import {
  findBuyerDetailLean,
  listBuyersLean,
} from '@/repositories/buyers/buyer-list.repository';
import { listBuyerOrdersLean } from '@/repositories/buyers/order.repository';

export const listBuyers = async (
  ctx: AdminAccessContext,
  query: { page: number; limit: number; search?: string }
) => {
  assertPermission(ctx, PERMISSIONS.BUYERS_READ, 'Alıcıları görüntüleme yetkin yok');

  const result = await listBuyersLean(query.page, query.limit, query.search);

  return result;
};

export const getBuyerById = async (ctx: AdminAccessContext, buyerId: string) => {
  if (!canReadBuyers(ctx)) {
    throw new AuthError(403, 'Alıcı profilini görüntüleme yetkin yok');
  }

  const detail = await findBuyerDetailLean(buyerId);

  if (!detail) {
    throw new AuthError(404, 'Alıcı bulunamadı');
  }

  const orders = await listBuyerOrdersLean(buyerId);

  return {
    buyer: {
      userId: String(detail.user._id),
      email: detail.user.email,
      isActive: detail.user.isActive,
      isEmailVerified: detail.user.isEmailVerified,
      createdAt: detail.user.createdAt,
      profile: detail.buyer,
    },
    recentOrders: orders.slice(0, 10).map((order) => ({
      id: String(order._id),
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    })),
    orderCount: orders.length,
  };
};
