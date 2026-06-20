import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SELLER_PERMISSIONS } from '@/internal/auth/access/seller/permission-keys';
import type { SellerAccessContext } from '@/internal/auth/queries/seller-context';
import { signAuthToken } from '@/internal/auth/tokens/access-token';
import { buildApp } from '@/app/app';
import { TEST_JWT_SECRET } from '../../../helpers/jwt-secret';

const mockCreateOrderFromCart = vi.fn();
const mockListSellerOrders = vi.fn();
const mockUpdateOrderStatus = vi.fn();
const mockCancelBuyerPendingOrder = vi.fn();
const mockGetSellerContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/buyers/orders/order.service', () => ({
  createOrderFromCart: (...args: unknown[]) => mockCreateOrderFromCart(...args),
  listBuyerOrders: vi.fn().mockResolvedValue([]),
  getBuyerOrderById: vi.fn(),
  listSellerOrders: (...args: unknown[]) => mockListSellerOrders(...args),
  getSellerOrderById: vi.fn(),
  updateOrderStatus: (...args: unknown[]) => mockUpdateOrderStatus(...args),
  cancelBuyerPendingOrder: (...args: unknown[]) => mockCancelBuyerPendingOrder(...args),
}));

vi.mock('@/internal/auth/queries/seller-context', () => ({
  getSellerContext: (...args: unknown[]) => mockGetSellerContext(...args),
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
const sellerId = '660e8400-e29b-41d4-a716-446655440000';
const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

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

describe('order routes integration', () => {
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

  it('POST /orders token olmadan 401 döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: {},
    });

    expect(response.statusCode).toBe(401);
  });

  it('GET /orders buyer token ile liste döner', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();

    const response = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('POST /orders sepetten sipariş oluşturur', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockCreateOrderFromCart.mockResolvedValue({
      id: '8c9e6679-7425-40de-944b-e07fc1f90ae8',
      status: 'pending',
      totalAmount: 200,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      message: 'Sipariş oluşturuldu',
      order: { status: 'pending' },
    });
  });

  it('GET /orders/seller token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/orders/seller' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /orders/seller onaylı satıcı sipariş listesi döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockListSellerOrders.mockResolvedValue([{ id: orderId, status: 'pending' }]);

    const response = await app.inject({
      method: 'GET',
      url: '/orders/seller',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ orders: [{ id: orderId, status: 'pending' }] });
  });

  it('PATCH /orders/:orderId/status sipariş durumunu günceller', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockUpdateOrderStatus.mockResolvedValue({ id: orderId, status: 'shipped' });

    const response = await app.inject({
      method: 'PATCH',
      url: `/orders/${orderId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'shipped' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Sipariş durumu güncellendi',
      order: { status: 'shipped' },
    });
  });

  it('POST /orders/:orderId/cancel bekleyen siparişi iptal eder', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockCancelBuyerPendingOrder.mockResolvedValue({ id: orderId, status: 'cancelled' });

    const response = await app.inject({
      method: 'POST',
      url: `/orders/${orderId}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Sipariş iptal edildi',
      order: { id: orderId, status: 'cancelled' },
    });
    expect(mockCancelBuyerPendingOrder).toHaveBeenCalledWith(buyerId, orderId);
  });
});
