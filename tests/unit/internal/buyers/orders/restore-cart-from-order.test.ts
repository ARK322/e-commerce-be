import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRestoreCartItemsForBuyer = vi.fn();
const mockFindOrderByIdLean = vi.fn();

vi.mock('@/domains/commerce/infrastructure/repositories/cart.repository', () => ({
  restoreCartItemsForBuyer: (...args: unknown[]) => mockRestoreCartItemsForBuyer(...args),
}));

vi.mock('@/domains/commerce/infrastructure/repositories/order.repository', () => ({
  findOrderByIdLean: (...args: unknown[]) => mockFindOrderByIdLean(...args),
}));

import { restoreCartFromOrder } from '@/domains/commerce/application/orders/restore-cart-from-order';

const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';
const buyerId = '550e8400-e29b-41d4-a716-446655440000';

describe('restoreCartFromOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRestoreCartItemsForBuyer.mockResolvedValue(undefined);
  });

  it('iptal edilen sipariş kalemlerini sepete geri yükler', async () => {
    mockFindOrderByIdLean.mockResolvedValue({
      buyerId,
      items: [
        { productId: 'prod-1', quantity: 2, price: 999 },
        { productId: 'prod-2', quantity: 1, price: 500 },
      ],
    });

    const restored = await restoreCartFromOrder(orderId);

    expect(restored).toBe(true);
    expect(mockRestoreCartItemsForBuyer).toHaveBeenCalledWith(buyerId, [
      { productId: 'prod-1', quantity: 2, priceSnapshot: 999 },
      { productId: 'prod-2', quantity: 1, priceSnapshot: 500 },
    ]);
  });

  it('sipariş yoksa false döner', async () => {
    mockFindOrderByIdLean.mockResolvedValue(null);

    const restored = await restoreCartFromOrder(orderId);

    expect(restored).toBe(false);
    expect(mockRestoreCartItemsForBuyer).not.toHaveBeenCalled();
  });
});
