import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOrderUpdateMany = vi.fn();
const mockPaymentDistinct = vi.fn();
const mockPaymentUpdateMany = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  Order: {
    updateMany: (...args: unknown[]) => mockOrderUpdateMany(...args),
  },
  Payment: {
    distinct: (...args: unknown[]) => mockPaymentDistinct(...args),
    updateMany: (...args: unknown[]) => mockPaymentUpdateMany(...args),
  },
}));

import { expirePendingOrders } from '@/internal/buyers/orders/expire-pending-orders';

describe('expirePendingOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPaymentDistinct.mockResolvedValue([]);
    mockOrderUpdateMany.mockResolvedValue({ modifiedCount: 2 });
    mockPaymentUpdateMany.mockResolvedValue({ modifiedCount: 0 });
  });

  it('aktif checkout olmayan pending siparişleri iptal eder', async () => {
    const count = await expirePendingOrders();

    expect(count).toBe(2);
    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        _id: { $nin: [] },
      }),
      { $set: { status: 'cancelled', updatedAt: expect.any(Date) } }
    );
  });

  it('aktif checkout ödemesi olan siparişleri atlar', async () => {
    mockPaymentDistinct.mockResolvedValue(['order-with-checkout']);

    await expirePendingOrders();

    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $nin: ['order-with-checkout'] },
      }),
      expect.any(Object)
    );
  });

  it('süresi dolan checkout ödemelerini failed yapar', async () => {
    mockPaymentDistinct.mockResolvedValue(['order-with-checkout']);
    mockPaymentUpdateMany.mockResolvedValue({ modifiedCount: 1 });

    await expirePendingOrders();

    expect(mockPaymentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: { $in: ['order-with-checkout'] },
        status: 'pending',
      }),
      { $set: { status: 'failed', updatedAt: expect.any(Date) } }
    );
  });
});
