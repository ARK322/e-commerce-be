import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signAuthToken } from '@/internal/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockCompletePaymentFromCheckoutToken = vi.fn();
const mockCreatePaymentForOrder = vi.fn();
const mockGetPaymentByOrderId = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();
const mockPaymentFindOne = vi.fn();

vi.mock('@/features/ecommerce/payment/payment.service', () => ({
  completePaymentFromCheckoutToken: (...args: unknown[]) =>
    mockCompletePaymentFromCheckoutToken(...args),
  createPaymentForOrder: (...args: unknown[]) => mockCreatePaymentForOrder(...args),
  getPaymentByOrderId: (...args: unknown[]) => mockGetPaymentByOrderId(...args),
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
    Payment: {
      findOne: (...args: unknown[]) => mockPaymentFindOne(...args),
    },
  };
});

const buyerId = '550e8400-e29b-41d4-a716-446655440000';
const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

describe('payment routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
    mockPaymentFindOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ orderId }),
      }),
    });
  });

  it('POST /payments token olmadan 401 döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/payments',
      payload: { orderId },
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /payments/callback token yoksa failed redirect döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/payments/callback',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: '',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain('/checkout?payment=failed');
  });

  it('POST /payments/callback doğrulama hatasında failed redirect döner', async () => {
    mockCompletePaymentFromCheckoutToken.mockRejectedValue(new Error('token bulunamadı'));

    const response = await app.inject({
      method: 'POST',
      url: '/payments/callback',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      payload: 'token=checkout-token-123',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain(`/orders/${orderId}?payment=failed`);
  });

  it('POST /payments/callback başarılı ödemede redirect döner', async () => {
    mockCompletePaymentFromCheckoutToken.mockResolvedValue({
      success: true,
      payment: { orderId },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/payments/callback',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'token=checkout-token-123',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain(`/orders/${orderId}?payment=success`);
  });

  it('POST /payments buyer ile ödeme başlatır', async () => {
    const token = signAuthToken(buyerId, 'buyer');
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
    mockCreatePaymentForOrder.mockResolvedValue({
      payment: { id: 'pay-1', orderId },
      checkout: { token: 'checkout-token', paymentPageUrl: 'https://sandbox.iyzipay.com/x' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/payments',
      headers: { authorization: `Bearer ${token}` },
      payload: { orderId },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      message: 'Ödeme sayfasına yönlendiriliyorsunuz',
      checkout: { paymentPageUrl: expect.stringContaining('iyzipay') },
    });
  });

  it('GET /payments/order/:orderId buyer ödeme kaydını döner', async () => {
    const token = signAuthToken(buyerId, 'buyer');
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
    mockGetPaymentByOrderId.mockResolvedValue({
      id: 'pay-1',
      orderId,
      status: 'completed',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/payments/order/${orderId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      payment: { id: 'pay-1', orderId, status: 'completed' },
    });
  });
});
