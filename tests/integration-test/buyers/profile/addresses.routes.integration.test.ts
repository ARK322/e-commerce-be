import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockListBuyerAddresses = vi.fn();
const mockAddBuyerAddress = vi.fn();
const mockUpdateBuyerAddress = vi.fn();
const mockDeleteBuyerAddress = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/buyers/profile/addresses.service', () => ({
  listBuyerAddresses: (...args: unknown[]) => mockListBuyerAddresses(...args),
  addBuyerAddress: (...args: unknown[]) => mockAddBuyerAddress(...args),
  updateBuyerAddress: (...args: unknown[]) => mockUpdateBuyerAddress(...args),
  deleteBuyerAddress: (...args: unknown[]) => mockDeleteBuyerAddress(...args),
}));

vi.mock('@/infrastructure/mongo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/mongo')>();
  return {
    ...actual,
    User: {
      ...actual.User,
      findById: (...args: unknown[]) => mockUserFindById(...args),
    },
    RevokedToken: {
      ...actual.RevokedToken,
      exists: (...args: unknown[]) => mockRevokedTokenExists(...args),
    },
  };
});

const buyerId = '550e8400-e29b-41d4-a716-446655440000';
const addressId = '660e8400-e29b-41d4-a716-446655440001';

const mockActiveBuyer = () => {
  mockUserFindById.mockImplementation((id: string) => {
    if (id === buyerId) {
      return {
        select: vi.fn().mockResolvedValue({
          _id: buyerId,
          role: 'buyer',
          isActive: true,
          isEmailVerified: true,
          passwordChangedAt: null,
          sessionsRevokedAt: null,
        }),
      };
    }

    return {
      select: vi.fn().mockResolvedValue({ isActive: true, isEmailVerified: true, role: 'buyer' }),
    };
  });
};

describe('addresses routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'integration-test-jwt-secret-with-32-chars-minimum';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
  });

  it('GET /auth/profile/addresses token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/profile/addresses' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/profile/addresses buyer ile adres listesi döner', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockListBuyerAddresses.mockResolvedValue([
      {
        id: addressId,
        label: 'Ev',
        firstName: 'Ali',
        lastName: 'Veli',
        phone: '+905551112233',
        country: 'Türkiye',
        city: 'İstanbul',
        address: 'Kadıköy',
        isDefaultDelivery: true,
        isDefaultBilling: false,
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/auth/profile/addresses',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      addresses: [
        expect.objectContaining({ id: addressId, city: 'İstanbul' }),
      ],
    });
  });

  it('POST /auth/profile/addresses geçersiz body ile 400 döner', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/profile/addresses',
      headers: { authorization: `Bearer ${token}` },
      payload: { firstName: 'Ali' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /auth/profile/addresses yeni adres oluşturur', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockAddBuyerAddress.mockResolvedValue({
      id: addressId,
      firstName: 'Ali',
      lastName: 'Veli',
      phone: '+905551112233',
      country: 'Türkiye',
      city: 'İstanbul',
      address: 'Üsküdar',
      isDefaultDelivery: true,
      isDefaultBilling: false,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/profile/addresses',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        firstName: 'Ali',
        lastName: 'Veli',
        phone: '+905551112233',
        country: 'Türkiye',
        city: 'İstanbul',
        address: 'Üsküdar',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockAddBuyerAddress).toHaveBeenCalledWith(buyerId, expect.objectContaining({ city: 'İstanbul' }));
  });

  it('PATCH /auth/profile/addresses/:addressId adres günceller', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockUpdateBuyerAddress.mockResolvedValue({
      id: addressId,
      city: 'Ankara',
      address: 'Çankaya',
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/auth/profile/addresses/${addressId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { city: 'Ankara', address: 'Çankaya' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ message: 'Adres güncellendi' });
    expect(mockUpdateBuyerAddress).toHaveBeenCalledWith(buyerId, addressId, expect.any(Object));
  });

  it('DELETE /auth/profile/addresses/:addressId adres siler', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockDeleteBuyerAddress.mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'DELETE',
      url: `/auth/profile/addresses/${addressId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Adres silindi' });
    expect(mockDeleteBuyerAddress).toHaveBeenCalledWith(buyerId, addressId);
  });
});
