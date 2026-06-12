import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuyerFindOne = vi.fn();
const mockBuyerFindOneAndUpdate = vi.fn();
const mockUserFindByIdAndUpdate = vi.fn();

vi.mock('../../../../../db', () => ({
  Buyer: {
    findOne: (...args: unknown[]) => mockBuyerFindOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockBuyerFindOneAndUpdate(...args),
  },
  User: {
    findByIdAndUpdate: (...args: unknown[]) => mockUserFindByIdAndUpdate(...args),
  },
}));

import { updateBuyerProfile } from './buyer.service';

const userId = '507f1f77bcf86cd799439011';

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
    mockBuyerFindOne.mockResolvedValue(null);

    await expect(updateBuyerProfile(userId, { firstName: 'Ali' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Alıcı profili bulunamadı',
    });
  });

  it('tam profilde isActive true olur', async () => {
    mockBuyerFindOne.mockResolvedValue({
      billingSameAsDelivery: true,
      deliveryAddress: 'Adres',
      toObject: () => completeBuyer,
    });
    mockBuyerFindOneAndUpdate.mockResolvedValue({
      toObject: () => completeBuyer,
    });

    const result = await updateBuyerProfile(userId, { lastName: 'Veli' });

    expect(result.isActive).toBe(true);
    expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith(userId, { isActive: true });
  });

  it('billingSameAsDelivery true iken fatura adresini teslimat adresine eşitler', async () => {
    mockBuyerFindOne.mockResolvedValue({
      billingSameAsDelivery: true,
      deliveryAddress: 'Eski adres',
    });
    mockBuyerFindOneAndUpdate.mockResolvedValue({
      toObject: () => ({ ...completeBuyer, deliveryAddress: 'Yeni adres' }),
    });

    await updateBuyerProfile(userId, { deliveryAddress: 'Yeni adres' });

    expect(mockBuyerFindOneAndUpdate).toHaveBeenCalledWith(
      { userId },
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
