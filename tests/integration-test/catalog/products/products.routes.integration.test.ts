import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SELLER_PERMISSIONS } from '@/domain/auth/access/seller/permission-keys';
import type { SellerAccessContext } from '@/domain/auth/queries/seller-context';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockListPublicProducts = vi.fn();
const mockGetPublicProductById = vi.fn();
const mockListSellerProducts = vi.fn();
const mockUpdateProduct = vi.fn();
const mockDeleteProduct = vi.fn();
const mockGetSellerContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/catalog/products/product.service', () => ({
  listPublicProducts: (...args: unknown[]) => mockListPublicProducts(...args),
  getPublicProductById: (...args: unknown[]) => mockGetPublicProductById(...args),
}));

vi.mock('@/features/sellers/products/seller-products.service', () => ({
  listSellerProducts: (...args: unknown[]) => mockListSellerProducts(...args),
  createProductWithImages: vi.fn(),
  updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
  deleteProduct: (...args: unknown[]) => mockDeleteProduct(...args),
}));

vi.mock('@/domain/auth/queries/seller-context', () => ({
  getSellerContext: (...args: unknown[]) => mockGetSellerContext(...args),
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

const productId = '550e8400-e29b-41d4-a716-446655440000';
const sellerId = '660e8400-e29b-41d4-a716-446655440000';

const sellerContext: SellerAccessContext = {
  userId: sellerId,
  companyId: sellerId,
  companyName: 'Test A.Ş.',
  sellerType: 'kurumsal',
  approvalStatus: 'approved',
  roleId: '770e8400-e29b-41d4-a716-446655440000',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(Object.values(SELLER_PERMISSIONS)),
  isOwner: true,
  teamManagementEnabled: true,
  member: { firstName: null, lastName: null, phone: null },
};

const mockApprovedSeller = () => {
  mockUserFindById.mockImplementation((id: string) => {
    if (id === sellerId) {
      return {
        select: vi.fn().mockResolvedValue({
          _id: sellerId,
          role: 'seller',
          isEmailVerified: true,
          passwordChangedAt: null,
          sessionsRevokedAt: null,
        }),
      };
    }

    return {
      select: vi.fn().mockResolvedValue({ isEmailVerified: true, role: 'seller' }),
    };
  });
  mockGetSellerContext.mockResolvedValue(sellerContext);
};

describe('product routes integration', () => {
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

  it('GET /products public liste döner', async () => {
    mockListPublicProducts.mockResolvedValue({
      products: [{ id: productId, name: 'Telefon' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const response = await app.inject({ method: 'GET', url: '/products' });

    expect(response.statusCode).toBe(200);
    expect(response.json().products).toHaveLength(1);
  });

  it('GET /products geçersiz query ile 400 döner', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/products?page=0',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz sorgu parametresi' });
  });

  it('GET /products/:productId geçersiz uuid ile 400 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/products/bad-id' });

    expect(response.statusCode).toBe(400);
  });

  it('GET /products/:productId ürün detayı döner', async () => {
    mockGetPublicProductById.mockResolvedValue({ id: productId, name: 'Telefon', price: 999 });

    const response = await app.inject({ method: 'GET', url: `/products/${productId}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().product.name).toBe('Telefon');
  });

  it('GET /auth/seller/products/mine token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/seller/products/mine' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/seller/products/mine onaylı satıcı ürünlerini döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockListSellerProducts.mockResolvedValue([{ id: productId, name: 'Telefon', price: 999 }]);

    const response = await app.inject({
      method: 'GET',
      url: '/auth/seller/products/mine',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().products).toHaveLength(1);
  });

  it('PATCH /auth/seller/products/:productId satıcı ürünü günceller', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockUpdateProduct.mockResolvedValue({ id: productId, name: 'Yeni Telefon', price: 1299 });

    const response = await app.inject({
      method: 'PATCH',
      url: `/auth/seller/products/${productId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Yeni Telefon', price: 1299 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Ürün güncellendi',
      product: { name: 'Yeni Telefon' },
    });
  });

  it('DELETE /auth/seller/products/:productId satıcı ürünü siler', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockDeleteProduct.mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'DELETE',
      url: `/auth/seller/products/${productId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Ürün silindi' });
  });
});
