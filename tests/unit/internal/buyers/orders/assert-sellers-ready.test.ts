import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindSellersByIdsLean = vi.fn();
const mockFindUsersByIdsLean = vi.fn();

vi.mock('@/repositories/sellers/seller.repository', () => ({
  findSellersByIdsLean: (...args: unknown[]) => mockFindSellersByIdsLean(...args),
}));

vi.mock('@/repositories/auth/user.repository', () => ({
  findUsersByIdsLean: (...args: unknown[]) => mockFindUsersByIdsLean(...args),
}));

import { assertSellersReadyForOrder } from '@/internal/buyers/orders/order-item-validation';
import { CommerceError } from '@/internal/common/errors/commerce-error';

const sellerId = '550e8400-e29b-41d4-a716-446655440000';

describe('assertSellersReadyForOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindSellersByIdsLean.mockResolvedValue([
      {
        _id: sellerId,
        approvalStatus: 'approved',
        iyzicoSubMerchantKey: 'sub-key',
      },
    ]);
    mockFindUsersByIdsLean.mockResolvedValue([
      {
        _id: sellerId,
        role: 'seller',
        isActive: true,
      },
    ]);
  });

  it('onaylı ve aktif satıcıya izin verir', async () => {
    await expect(assertSellersReadyForOrder([{ sellerId }])).resolves.toBeUndefined();
  });

  it('deaktif satıcıya sipariş oluşturmayı engeller', async () => {
    mockFindUsersByIdsLean.mockResolvedValue([
      {
        _id: sellerId,
        role: 'seller',
        isActive: false,
      },
    ]);

    await expect(assertSellersReadyForOrder([{ sellerId }])).rejects.toBeInstanceOf(CommerceError);
  });
});
