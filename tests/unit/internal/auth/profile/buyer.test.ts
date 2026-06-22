import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindBuyerById = vi.fn();
const mockUpdateBuyerById = vi.fn();
const mockUpdateUserById = vi.fn();

vi.mock('@/domains/identity/infrastructure/repositories/buyer.repository', () => ({
  findBuyerById: (...args: unknown[]) => mockFindBuyerById(...args),
  updateBuyerById: (...args: unknown[]) => mockUpdateBuyerById(...args),
}));

vi.mock('@/domains/identity/infrastructure/repositories/auth/user.repository', () => ({
  updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
}));

import { updateBuyerProfile } from '@/domains/identity/application/profile/buyer';

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
    mockUpdateUserById.mockResolvedValue(undefined);
  });

  it('alıcı profili yoksa 404 döner', async () => {
    mockFindBuyerById.mockResolvedValue(null);

    await expect(updateBuyerProfile(userId, { firstName: 'Ali' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Alıcı profili bulunamadı',
    });
  });

  it('tam profilde isActive true olur', async () => {
    mockFindBuyerById.mockResolvedValue({
      billingSameAsDelivery: true,
      deliveryAddress: 'Adres',
      toObject: () => completeBuyer,
    });
    mockUpdateBuyerById.mockResolvedValue({
      toObject: () => completeBuyer,
    });

    const result = await updateBuyerProfile(userId, { lastName: 'Veli' });

    expect(result.isActive).toBe(true);
    expect(mockUpdateUserById).toHaveBeenCalledWith(userId, { $set: { isActive: true } });
  });

  it('billingSameAsDelivery true iken fatura adresini teslimat adresine eşitler', async () => {
    mockFindBuyerById.mockResolvedValue({
      billingSameAsDelivery: true,
      deliveryAddress: 'Eski adres',
    });
    mockUpdateBuyerById.mockResolvedValue({
      toObject: () => ({ ...completeBuyer, deliveryAddress: 'Yeni adres' }),
    });

    await updateBuyerProfile(userId, { deliveryAddress: 'Yeni adres' });

    expect(mockUpdateBuyerById).toHaveBeenCalledWith(
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
