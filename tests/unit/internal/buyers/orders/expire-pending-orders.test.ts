import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindExpiringPendingOrdersLean = vi.fn();
const mockCancelPendingOrder = vi.fn();
const mockDistinctPendingCheckoutOrderIds = vi.fn();
const mockFailStalePendingPayments = vi.fn();

vi.mock('@/repositories/buyers/order.repository', () => ({
  findExpiringPendingOrdersLean: (...args: unknown[]) => mockFindExpiringPendingOrdersLean(...args),
}));

vi.mock('@/repositories/buyers/payment.repository', () => ({
  distinctPendingCheckoutOrderIds: (...args: unknown[]) => mockDistinctPendingCheckoutOrderIds(...args),
  failStalePendingPayments: (...args: unknown[]) => mockFailStalePendingPayments(...args),
}));

vi.mock('@/domain/orders/cancel-pending-order', () => ({
  cancelPendingOrder: (...args: unknown[]) => mockCancelPendingOrder(...args),
}));

import { expirePendingOrders } from '@/domain/orders/expire-pending-orders';

describe('expirePendingOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDistinctPendingCheckoutOrderIds.mockResolvedValue([]);
    mockFindExpiringPendingOrdersLean.mockResolvedValue([{ _id: 'o1' }, { _id: 'o2' }]);
    mockCancelPendingOrder.mockResolvedValue(true);
    mockFailStalePendingPayments.mockResolvedValue({ modifiedCount: 0 });
  });

  it('aktif checkout olmayan pending siparişleri iptal eder', async () => {
    const count = await expirePendingOrders();

    expect(count).toBe(2);
    expect(mockFindExpiringPendingOrdersLean).toHaveBeenCalledWith(
      expect.any(Date),
      []
    );
    expect(mockCancelPendingOrder).toHaveBeenCalledTimes(2);
  });

  it('aktif checkout ödemesi olan siparişleri atlar', async () => {
    mockDistinctPendingCheckoutOrderIds.mockResolvedValue(['order-with-checkout']);

    await expirePendingOrders();

    expect(mockFindExpiringPendingOrdersLean).toHaveBeenCalledWith(
      expect.any(Date),
      ['order-with-checkout']
    );
  });

  it('süresi dolan checkout ödemelerini failed yapar', async () => {
    mockDistinctPendingCheckoutOrderIds.mockResolvedValue(['order-with-checkout']);
    mockFailStalePendingPayments.mockResolvedValue({ modifiedCount: 1 });

    await expirePendingOrders();

    expect(mockFailStalePendingPayments).toHaveBeenCalledWith(
      ['order-with-checkout'],
      expect.any(Date)
    );
  });
});
