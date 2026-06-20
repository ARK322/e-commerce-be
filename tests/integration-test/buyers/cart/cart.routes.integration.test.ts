import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signAuthToken } from '@/internal/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockGetCart = vi.fn();
const mockAddToCart = vi.fn();
const mockClearCart = vi.fn();
const mockUpdateCartItem = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/buyers/cart/cart.service', () => ({
  getCart: (...args: unknown[]) => mockGetCart(...args),
  addToCart: (...args: unknown[]) => mockAddToCart(...args),
  updateCartItem: (...args: unknown[]) => mockUpdateCartItem(...args),
  removeCartItem: vi.fn(),
  clearCart: (...args: unknown[]) => mockClearCart(...args),
}));

vi.mock('@/integrations/mongo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/integrations/mongo')>();
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
const productId = '660e8400-e29b-41d4-a716-446655440000';

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

describe('cart routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-jwt-secret-with-32-chars-minimum';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
  });

  it('GET /cart token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/cart' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /cart buyer token ile sepet döner', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockGetCart.mockResolvedValue({ items: [], totalAmount: 0 });

    const response = await app.inject({
      method: 'GET',
      url: '/cart',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ cart: { items: [], totalAmount: 0 } });
  });

  it('POST /cart/items geçersiz body ile 400 döner', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();

    const response = await app.inject({
      method: 'POST',
      url: '/cart/items',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('POST /cart/items ürün ekler', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockAddToCart.mockResolvedValue({
      items: [{ productId, quantity: 2 }],
      totalAmount: 100,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/cart/items',
      headers: { authorization: `Bearer ${token}` },
      payload: { productId, quantity: 2 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Ürün sepete eklendi',
      cart: { totalAmount: 100 },
    });
  });

  it('DELETE /cart sepeti temizler', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockClearCart.mockResolvedValue({ items: [], totalAmount: 0 });

    const response = await app.inject({
      method: 'DELETE',
      url: '/cart',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Sepet temizlendi',
      cart: { items: [], totalAmount: 0 },
    });
  });

  it('PATCH /cart/items/:productId miktar günceller', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockUpdateCartItem.mockResolvedValue({
      items: [{ productId, quantity: 3 }],
      totalAmount: 150,
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/cart/items/${productId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { quantity: 3 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Sepet güncellendi',
      cart: { totalAmount: 150 },
    });
  });
});
