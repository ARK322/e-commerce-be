import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockOrderFindOne,
  mockOrderFindById,
  mockPaymentFindOne,
  mockPaymentCreate,
  mockUserFindById,
  mockBuyerFindById,
  mockProductFindOne,
  mockSellerFind,
  mockInitializeIyzicoCheckout,
  mockCompleteIyzicoCheckout,
  mockBuildPaymentSplitsForOrder,
  mockReservePendingOrderStock,
  mockFulfillPaidOrder,
  mockCancelPendingOrder,
  mockFindSellersByIdsLean,
  mockFindUsersByIdsLean,
} = vi.hoisted(() => ({
  mockOrderFindOne: vi.fn(),
  mockOrderFindById: vi.fn(),
  mockPaymentFindOne: vi.fn(),
  mockPaymentCreate: vi.fn(),
  mockUserFindById: vi.fn(),
  mockBuyerFindById: vi.fn(),
  mockProductFindOne: vi.fn(),
  mockSellerFind: vi.fn(),
  mockInitializeIyzicoCheckout: vi.fn(),
  mockCompleteIyzicoCheckout: vi.fn(),
  mockBuildPaymentSplitsForOrder: vi.fn(),
  mockReservePendingOrderStock: vi.fn(),
  mockFulfillPaidOrder: vi.fn(),
  mockCancelPendingOrder: vi.fn(),
  mockFindSellersByIdsLean: vi.fn(),
  mockFindUsersByIdsLean: vi.fn(),
}));

vi.mock('@/integrations/iyzico/initialize-checkout', () => ({
  initializeIyzicoCheckout: (...args: unknown[]) => mockInitializeIyzicoCheckout(...args),
}));

vi.mock('@/integrations/iyzico/retrieve-checkout', () => ({
  completeIyzicoCheckout: (...args: unknown[]) => mockCompleteIyzicoCheckout(...args),
}));

vi.mock('@/internal/buyers/payment/payment-split', () => ({
  buildPaymentSplitsForOrder: (...args: unknown[]) => mockBuildPaymentSplitsForOrder(...args),
  syncPaymentSplitTransactionIds: vi.fn(),
}));

vi.mock('@/internal/buyers/orders/fulfill-order', () => ({
  fulfillPaidOrder: (...args: unknown[]) => mockFulfillPaidOrder(...args),
}));

vi.mock('@/internal/buyers/orders/reserve-order-stock', () => ({
  reservePendingOrderStock: (...args: unknown[]) => mockReservePendingOrderStock(...args),
}));

vi.mock('@/internal/sellers/wallet/credit-pending-from-order', () => ({
  creditSellerPendingFromPaidOrder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/internal/buyers/orders/cancel-pending-order', () => ({
  cancelPendingOrder: (...args: unknown[]) => mockCancelPendingOrder(...args),
}));

vi.mock('@/repositories/sellers/seller.repository', () => ({
  findSellersByIdsLean: (...args: unknown[]) => mockFindSellersByIdsLean(...args),
}));

vi.mock('@/repositories/auth/user.repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/repositories/auth/user.repository')>();
  return {
    ...actual,
    findUsersByIdsLean: (...args: unknown[]) => mockFindUsersByIdsLean(...args),
  };
});

vi.mock('@/internal/catalog/product/assert-purchasable-product', () => ({
  assertPurchasableCatalogProduct: vi.fn().mockResolvedValue({
    _id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    stock: 10,
    isActive: true,
  }),
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
  Product: {
    findOne: (...args: unknown[]) => mockProductFindOne(...args),
  },
  Seller: {
    find: (...args: unknown[]) => mockSellerFind(...args),
  },
  User: { findById: (...args: unknown[]) => mockUserFindById(...args) },
  Buyer: { findById: (...args: unknown[]) => mockBuyerFindById(...args) },
}));

vi.mock('@/internal/common/ids', () => ({
  createUserId: () => '9c9e6679-7425-40de-944b-e07fc1f90ae9',
}));

import {
  completePaymentFromCheckoutToken,
  createPaymentForOrder,
  getPaymentByOrderId,
} from '@/features/buyers/payments/payment.service';

const buyerId = '550e8400-e29b-41d4-a716-446655440000';
const sellerId = '660e8400-e29b-41d4-a716-446655440001';
const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';
const productId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const pendingOrder = {
  _id: orderId,
  buyerId,
  totalAmount: 1998,
  currency: 'TRY',
  status: 'pending',
  stockReserved: false,
  items: [
    {
      productId,
      sellerId,
      name: 'Ürün',
      price: 999,
      quantity: 2,
      subtotal: 1998,
    },
  ],
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

const productRecord = {
  _id: productId,
  stock: 10,
  isActive: true,
};

const approvedSeller = {
  _id: sellerId,
  approvalStatus: 'approved',
  iyzicoSubMerchantKey: 'sub-merchant-key',
};

const mockLeanOrder = (order: typeof pendingOrder | null) => ({
  lean: vi.fn().mockResolvedValue(order),
});

const mockApprovedSellersAndStock = () => {
  mockSellerFind.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue([approvedSeller]),
    }),
  });
  mockFindSellersByIdsLean.mockResolvedValue([approvedSeller]);
  mockFindUsersByIdsLean.mockResolvedValue([
    { _id: sellerId, role: 'seller', isActive: true },
  ]);
  mockProductFindOne.mockReturnValue({
    lean: vi.fn().mockResolvedValue(productRecord),
  });
};

describe('createPaymentForOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue(userRecord) });
    mockBuyerFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue(buyerRecord) });
    mockApprovedSellersAndStock();
    mockInitializeIyzicoCheckout.mockResolvedValue({
      token: 'iyzico-token',
      paymentPageUrl: 'https://sandbox-cpp.iyzipay.com?token=iyzico-token',
      checkoutFormContent: null,
    });
    mockBuildPaymentSplitsForOrder.mockResolvedValue([
      {
        productId,
        sellerId,
        subtotal: 1998,
        commissionAmount: 199.8,
        sellerShare: 1798.2,
        checkoutItem: {
          productId,
          name: 'Ürün',
          price: 999,
          quantity: 2,
          subtotal: 1998,
          subMerchantKey: 'sub-merchant-key',
          subMerchantPrice: 1798.2,
        },
      },
    ]);
    mockReservePendingOrderStock.mockResolvedValue(true);
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

  it('ödeme işleniyorsa 409 fırlatır', async () => {
    mockOrderFindOne.mockReturnValue(mockLeanOrder(pendingOrder));
    mockPaymentFindOne.mockResolvedValue({ status: 'processing' });

    await expect(createPaymentForOrder(buyerId, { orderId })).rejects.toMatchObject({
      statusCode: 409,
      message: 'Bu sipariş için ödeme işleniyor',
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

  it('stok zaten rezerve edilmişse tekrar rezerve etmez', async () => {
    mockOrderFindOne.mockReturnValue(
      mockLeanOrder({
        ...pendingOrder,
        stockReserved: true,
      })
    );
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

    await createPaymentForOrder(buyerId, { orderId });

    expect(mockReservePendingOrderStock).not.toHaveBeenCalled();
  });

  it('stok rezerve edilmiş siparişte kalan stok 0 olsa bile ödemeye izin verir', async () => {
    mockOrderFindOne.mockReturnValue(
      mockLeanOrder({
        ...pendingOrder,
        stockReserved: true,
      })
    );
    mockPaymentFindOne.mockResolvedValue(null);
    mockProductFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...productRecord,
        stock: 0,
      }),
    });
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

    await expect(createPaymentForOrder(buyerId, { orderId })).resolves.toMatchObject({
      payment: { status: 'pending' },
    });
  });
});

describe('completePaymentFromCheckoutToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCancelPendingOrder.mockResolvedValue(true);
    mockFulfillPaidOrder.mockResolvedValue(undefined);
  });

  it('başarısız ödemede pending siparişi iptal eder', async () => {
    mockCompleteIyzicoCheckout.mockResolvedValue({
      status: 'failed',
      orderId,
      reason: 'card_declined',
    });
    mockPaymentFindOne.mockResolvedValue({
      orderId,
      buyerId,
      amount: 1998,
      currency: 'TRY',
      status: 'pending',
      save: vi.fn().mockResolvedValue(undefined),
      toObject: () => ({
        _id: 'pay-1',
        orderId,
        buyerId,
        amount: 1998,
        currency: 'TRY',
        status: 'failed',
      }),
    });

    const result = await completePaymentFromCheckoutToken('token-1');

    expect(result.success).toBe(false);
    expect(mockCancelPendingOrder).toHaveBeenCalledWith(orderId);
    expect(mockFulfillPaidOrder).not.toHaveBeenCalled();
  });

  it('başarılı ödemede stok düşer ve sipariş paid olur', async () => {
    mockCompleteIyzicoCheckout.mockResolvedValue({
      status: 'completed',
      orderId,
      externalId: 'iyzico-payment-id',
      paidAmount: 1998,
      itemTransactions: [],
    });
    mockPaymentFindOne.mockResolvedValue({
      orderId,
      buyerId,
      amount: 1998,
      currency: 'TRY',
      status: 'pending',
      save: vi.fn().mockResolvedValue(undefined),
      toObject: () => ({
        _id: 'pay-1',
        orderId,
        buyerId,
        amount: 1998,
        currency: 'TRY',
        provider: 'iyzico',
        externalId: 'iyzico-payment-id',
        status: 'completed',
      }),
    });
    mockOrderFindById.mockReturnValue(mockLeanOrder(pendingOrder));

    const result = await completePaymentFromCheckoutToken('token-1');

    expect(result.success).toBe(true);
    expect(mockFulfillPaidOrder).toHaveBeenCalledWith(orderId, [
      { productId, quantity: 2 },
    ]);
    expect(mockCancelPendingOrder).not.toHaveBeenCalled();
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
