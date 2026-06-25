import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SELLER_PERMISSIONS } from '@/domain/auth/access/seller/permission-keys';
import type { SellerAccessContext } from '@/domain/auth/queries/seller-context';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';
import { TEST_JWT_SECRET } from '../../../helpers/jwt-secret';

const mockListSellerProducts = vi.fn();
const mockCreateProductFromRequest = vi.fn();
const mockUpdateProduct = vi.fn();
const mockDeleteProduct = vi.fn();
const mockAddProductImage = vi.fn();
const mockRemoveProductImage = vi.fn();
const mockGetSellerContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

const boundary = '----cursor-product-test-boundary';

const buildMultipartFile = (field: string, filename: string, contentType: string, data: Buffer) => {
  const chunks = [
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];
  return Buffer.concat(chunks);
};

vi.mock('@/features/sellers/products/seller-products.service', () => ({
  listSellerProducts: (...args: unknown[]) => mockListSellerProducts(...args),
  createProductFromRequest: (...args: unknown[]) => mockCreateProductFromRequest(...args),
  updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
  deleteProduct: (...args: unknown[]) => mockDeleteProduct(...args),
  addProductImage: (...args: unknown[]) => mockAddProductImage(...args),
  removeProductImage: (...args: unknown[]) => mockRemoveProductImage(...args),
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

const sellerId = '550e8400-e29b-41d4-a716-446655440000';
const productId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

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

describe('seller products routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? TEST_JWT_SECRET;
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
  });

  it('GET /auth/seller/products/mine token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/seller/products/mine' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/seller/products/mine ürün listesi döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockListSellerProducts.mockResolvedValue([{ id: productId, name: 'Ürün' }]);

    const response = await app.inject({
      method: 'GET',
      url: '/auth/seller/products/mine',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ products: [{ id: productId, name: 'Ürün' }] });
  });

  it('POST /auth/seller/products ürün oluşturur', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockCreateProductFromRequest.mockResolvedValue({
      product: { id: productId, name: 'Yeni Ürün' },
      imageCount: 0,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/seller/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      message: 'Ürün oluşturuldu',
      product: { name: 'Yeni Ürün' },
    });
  });

  it('POST /auth/seller/products/:productId/images görsel yükler', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockAddProductImage.mockResolvedValue({
      product: { id: productId, images: ['https://cdn.test/img.png'] },
      imageUrl: 'https://cdn.test/img.png',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/auth/seller/products/${productId}/images`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: buildMultipartFile('file', 'test.png', 'image/png', Buffer.from('fake-png')),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ message: 'Ürün görseli yüklendi' });
  });

  it('DELETE /auth/seller/products/:productId/images görsel siler', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockRemoveProductImage.mockResolvedValue({
      product: { id: productId, images: [] },
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/auth/seller/products/${productId}/images`,
      headers: { authorization: `Bearer ${token}` },
      payload: { url: 'https://cdn.test/img.png' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ message: 'Ürün görseli silindi' });
  });

  it('PATCH /auth/seller/products/:productId ürün günceller', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockUpdateProduct.mockResolvedValue({ id: productId, name: 'Güncel' });

    const response = await app.inject({
      method: 'PATCH',
      url: `/auth/seller/products/${productId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Güncel', price: 199 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Ürün güncellendi',
      product: { name: 'Güncel' },
    });
  });

  it('DELETE /auth/seller/products/:productId ürün siler', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockDeleteProduct.mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'DELETE',
      url: `/auth/seller/products/${productId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(mockDeleteProduct).toHaveBeenCalled();
  });
});
