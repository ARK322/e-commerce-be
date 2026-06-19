import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuyerFindById = vi.fn();
const mockBuyerFindByIdAndUpdate = vi.fn();
const mockUserFindByIdAndUpdate = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  Buyer: {
    findById: (...args: unknown[]) => mockBuyerFindById(...args),
    findByIdAndUpdate: (...args: unknown[]) => mockBuyerFindByIdAndUpdate(...args),
  },
  User: {
    findByIdAndUpdate: (...args: unknown[]) => mockUserFindByIdAndUpdate(...args),
  },
}));

import { updateBuyerProfile } from '@/internal/auth/profile/buyer';

const userId = '550e8400-e29b-41d4-a716-446655440000';

const completeBuyer = {
  firstName: 'Ali',
  lastName: 'Veli',
  phone: '05551234567',
  country: 'TR',
  city: 'Istanbul',
  nationalId: '12345678901',
  deliveryAddress: 'Teslimat adresi 1',
  billingSameAsDelivery: true,
  billingAddress: 'Teslimat adresi 1',
};

describe('updateBuyerProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindByIdAndUpdate.mockResolvedValue(undefined);
  });

  it('alıcı profili yoksa 404 döner', async () => {
    mockBuyerFindById.mockResolvedValue(null);

    await expect(updateBuyerProfile(userId, { firstName: 'Ali' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Alıcı profili bulunamadı',
    });
  });

  it('tam profilde isActive true olur', async () => {
    mockBuyerFindById.mockResolvedValue({
      billingSameAsDelivery: true,
      deliveryAddress: 'Adres',
      toObject: () => completeBuyer,
    });
    mockBuyerFindByIdAndUpdate.mockResolvedValue({
      toObject: () => completeBuyer,
    });

    const result = await updateBuyerProfile(userId, { lastName: 'Veli' });

    expect(result.isActive).toBe(true);
    expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith(userId, { isActive: true });
  });

  it('billingSameAsDelivery true iken fatura adresini teslimat adresine eşitler', async () => {
    mockBuyerFindById.mockResolvedValue({
      billingSameAsDelivery: true,
      deliveryAddress: 'Eski adres',
    });
    mockBuyerFindByIdAndUpdate.mockResolvedValue({
      toObject: () => ({ ...completeBuyer, deliveryAddress: 'Yeni adres' }),
    });

    await updateBuyerProfile(userId, { deliveryAddress: 'Yeni adres' });

    expect(mockBuyerFindByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      {
        $set: expect.objectContaining({
          deliveryAddress: 'Yeni adres',
          billingAddress: 'Yeni adres',
          billingSameAsDelivery: true,
        }),
      },
      { returnDocument: 'after' }
    );
  });
});
