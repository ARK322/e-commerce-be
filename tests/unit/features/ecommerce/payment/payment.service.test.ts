import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOrderFindOne = vi.fn();
const mockOrderFindById = vi.fn();
const mockPaymentFindOne = vi.fn();
const mockPaymentCreate = vi.fn();
const mockUserFindById = vi.fn();
const mockBuyerFindById = vi.fn();
const mockInitializeIyzicoCheckout = vi.fn();
const mockBuildPaymentSplitsForOrder = vi.fn();

vi.mock('@/integrations/iyzico/initialize-checkout', () => ({
  initializeIyzicoCheckout: (...args: unknown[]) => mockInitializeIyzicoCheckout(...args),
}));

vi.mock('@/internal/ecommerce/payment/payment-split', () => ({
  buildPaymentSplitsForOrder: (...args: unknown[]) => mockBuildPaymentSplitsForOrder(...args),
  syncPaymentSplitTransactionIds: vi.fn(),
}));

vi.mock('@/integrations/iyzico/retrieve-checkout', () => ({
  completeIyzicoCheckout: vi.fn(),
}));

vi.mock('@/integrations/mongo', () => ({
  Order: {
    findOne: (...args: unknown[]) => mockOrderFindOne(...args),
    findById: (...args: unknown[]) => mockOrderFindById(...args),
  },
  Payment: {
    findOne: (...args: unknown[]) => mockPaymentFindOne(...args),
    create: (...args: unknown[]) => mockPaymentCreate(...args),
  },
  User: { findById: (...args: unknown[]) => mockUserFindById(...args) },
  Buyer: { findById: (...args: unknown[]) => mockBuyerFindById(...args) },
}));

vi.mock('@/internal/ids', () => ({
  createUserId: () => '9c9e6679-7425-40de-944b-e07fc1f90ae9',
}));

import {
  createPaymentForOrder,
  getPaymentByOrderId,
} from '@/features/ecommerce/payment/payment.service';

const buyerId = '550e8400-e29b-41d4-a716-446655440000';
const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

const pendingOrder = {
  _id: orderId,
  buyerId,
  totalAmount: 1998,
  currency: 'TRY',
  status: 'pending',
  items: [{ productId: 'p1', sellerId: 's1', name: 'Ürün', price: 999, quantity: 2, subtotal: 1998 }],
};

const userRecord = {
  email: 'buyer@example.com',
  createdAt: new Date('2024-01-01'),
};

const buyerRecord = {
  firstName: 'Ali',
  lastName: 'Veli',
  phone: '05551234567',
  nationalId: '11111111111',
  country: 'Turkey',
  city: 'Istanbul',
  deliveryAddress: 'Test adres',
};

const mockLeanOrder = (order: typeof pendingOrder | null) => ({
  lean: vi.fn().mockResolvedValue(order),
});

describe('createPaymentForOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue(userRecord) });
    mockBuyerFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue(buyerRecord) });
    mockInitializeIyzicoCheckout.mockResolvedValue({
      token: 'iyzico-token',
      paymentPageUrl: 'https://sandbox-cpp.iyzipay.com?token=iyzico-token',
      checkoutFormContent: null,
    });
    mockBuildPaymentSplitsForOrder.mockResolvedValue([
      {
        productId: 'p1',
        sellerId: 's1',
        subtotal: 1998,
        commissionAmount: 199.8,
        sellerShare: 1798.2,
        checkoutItem: {
          productId: 'p1',
          name: 'Ürün',
          price: 999,
          quantity: 2,
          subtotal: 1998,
          subMerchantKey: 'sub-merchant-key',
          subMerchantPrice: 1798.2,
        },
      },
    ]);
  });

  it('sipariş pending değilse 400 fırlatır', async () => {
    mockOrderFindOne.mockReturnValue(
      mockLeanOrder({
        ...pendingOrder,
        status: 'paid',
      })
    );

    await expect(createPaymentForOrder(buyerId, { orderId })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Sipariş ödemeye uygun değil',
    });
  });

  it('ödeme tamamlanmışsa 409 fırlatır', async () => {
    mockOrderFindOne.mockReturnValue(mockLeanOrder(pendingOrder));
    mockPaymentFindOne.mockResolvedValue({ status: 'completed' });

    await expect(createPaymentForOrder(buyerId, { orderId })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('iyzico checkout başlatır ve pending ödeme döner', async () => {
    mockOrderFindOne.mockReturnValue(mockLeanOrder(pendingOrder));
    mockPaymentFindOne.mockResolvedValue(null);
    mockPaymentCreate.mockResolvedValue({
      toObject: () => ({
        _id: '9c9e6679-7425-40de-944b-e07fc1f90ae9',
        orderId,
        buyerId,
        amount: 1998,
        currency: 'TRY',
        provider: 'iyzico',
        externalId: 'iyzico-token',
        status: 'pending',
      }),
      save: vi.fn().mockResolvedValue(undefined),
      provider: null,
      externalId: null,
      status: 'pending',
      updatedAt: undefined,
    });

    const result = await createPaymentForOrder(buyerId, { orderId });

    expect(mockBuildPaymentSplitsForOrder).toHaveBeenCalledWith(orderId, pendingOrder.items);
    expect(mockInitializeIyzicoCheckout).toHaveBeenCalled();
    expect(result.checkout.paymentPageUrl).toContain('iyzico-token');
    expect(result.payment.status).toBe('pending');
    expect(result.payment.provider).toBe('iyzico');
  });
});

describe('getPaymentByOrderId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderFindOne.mockReturnValue(mockLeanOrder(pendingOrder));
  });

  it('ödeme yoksa 404 fırlatır', async () => {
    mockPaymentFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    await expect(getPaymentByOrderId(buyerId, orderId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
