import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import type { AdminAccessContext } from '@/domains/identity/application/queries/admin-context';

const mockListAdminOrdersLean = vi.fn();
const mockFindOrderByIdLean = vi.fn();
const mockFindPaymentByOrderIdLean = vi.fn();

vi.mock('@/domains/commerce/infrastructure/repositories/order.repository', () => ({
  listAdminOrdersLean: (...args: unknown[]) => mockListAdminOrdersLean(...args),
  findOrderByIdLean: (...args: unknown[]) => mockFindOrderByIdLean(...args),
}));

vi.mock('@/domains/payments/infrastructure/repositories/payment.repository', () => ({
  findPaymentByOrderIdLean: (...args: unknown[]) => mockFindPaymentByOrderIdLean(...args),
}));

import { getAdminOrderById, listAdminOrders } from '@/api/admin/orders/orders.service';
import { AuthError } from '@/domains/identity/application/errors';

const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

const ownerCtx: AdminAccessContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  roleId: '660e8400-e29b-41d4-a716-446655440000',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(Object.values(PERMISSIONS)),
  isOwner: true,
};

const noOrdersCtx: AdminAccessContext = {
  userId: '550e8400-e29b-41d4-a716-446655440001',
  roleId: '660e8400-e29b-41d4-a716-446655440002',
  roleSlug: 'viewer',
  roleName: 'Viewer',
  permissions: new Set([PERMISSIONS.SELLERS_READ]),
  isOwner: false,
};

describe('listAdminOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('orders.read yetkisi olmadan 403 döner', async () => {
    await expect(
      listAdminOrders(noOrdersCtx, { limit: 20, offset: 0 })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('sipariş listesini döner', async () => {
    mockListAdminOrdersLean.mockResolvedValue({
      items: [
        {
          _id: orderId,
          buyerId: 'buyer-1',
          items: [{ sellerId: 'seller-1' }],
          totalAmount: 100,
          currency: 'TRY',
          status: 'paid',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
    });

    const result = await listAdminOrders(ownerCtx, { limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(orderId);
    expect(result.items[0]?.sellerIds).toEqual(['seller-1']);
  });
});

describe('getAdminOrderById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sipariş ve ödeme özetini döner', async () => {
    mockFindOrderByIdLean.mockResolvedValue({
      _id: orderId,
      buyerId: 'buyer-1',
      items: [],
      totalAmount: 100,
      currency: 'TRY',
      status: 'paid',
      shippingAddress: {},
    });
    mockFindPaymentByOrderIdLean.mockResolvedValue({
      _id: 'pay-1',
      status: 'completed',
      amount: 100,
      currency: 'TRY',
    });

    const result = await getAdminOrderById(ownerCtx, orderId);

    expect(result.order.id).toBe(orderId);
    expect(result.payment?.status).toBe('completed');
  });
});
