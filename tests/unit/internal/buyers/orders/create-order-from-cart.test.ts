import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCartFindOneAndUpdate,
  mockBuyerFindById,
  mockProductFindOne,
  mockSellerFind,
  mockOrderCreate,
  mockOrderFindOne,
  mockWithTransaction,
  mockEndSession,
  mockSession,
  mockAssertPurchasableCatalogProduct,
  mockReservePendingOrderStock,
  mockCancelPendingOrder,
  mockRestoreCartItemsForBuyer,
} = vi.hoisted(() => {
  const mockWithTransaction = vi.fn();
  const mockEndSession = vi.fn().mockResolvedValue(undefined);
  const mockSession = {
    withTransaction: mockWithTransaction,
    endSession: mockEndSession,
  };

  return {
    mockCartFindOneAndUpdate: vi.fn(),
    mockBuyerFindById: vi.fn(),
    mockProductFindOne: vi.fn(),
    mockSellerFind: vi.fn(),
    mockOrderCreate: vi.fn(),
    mockOrderFindOne: vi.fn(),
    mockWithTransaction,
    mockEndSession,
    mockSession,
    mockAssertPurchasableCatalogProduct: vi.fn(),
    mockReservePendingOrderStock: vi.fn(),
    mockCancelPendingOrder: vi.fn(),
    mockRestoreCartItemsForBuyer: vi.fn(),
  };
});

vi.mock('@/domains/catalog/application/product/assert-purchasable-product', () => ({
  assertPurchasableCatalogProduct: (...args: unknown[]) =>
    mockAssertPurchasableCatalogProduct(...args),
}));

vi.mock('@/domains/commerce/application/orders/reserve-order-stock', () => ({
  reservePendingOrderStock: (...args: unknown[]) => mockReservePendingOrderStock(...args),
}));

vi.mock('@/domains/commerce/application/orders/cancel-pending-order', () => ({
  cancelPendingOrder: (...args: unknown[]) => mockCancelPendingOrder(...args),
}));

vi.mock('@/domains/commerce/infrastructure/repositories/cart.repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/commerce/infrastructure/repositories/cart.repository')>();

  return {
    ...actual,
    clearNonEmptyCartInSession: (...args: unknown[]) => mockCartFindOneAndUpdate(...args),
    restoreCartItemsForBuyer: (...args: unknown[]) => mockRestoreCartItemsForBuyer(...args),
  };
});

vi.mock('mongoose', () => ({
  default: {
    startSession: vi.fn().mockResolvedValue(mockSession),
  },
}));

vi.mock('@/integrations/mongo', () => ({
  Cart: {
    findOneAndUpdate: (...args: unknown[]) => mockCartFindOneAndUpdate(...args),
  },
  Buyer: {
    findById: (...args: unknown[]) => mockBuyerFindById(...args),
  },
  Product: {
    findOne: (...args: unknown[]) => mockProductFindOne(...args),
  },
  Seller: {
    find: (...args: unknown[]) => mockSellerFind(...args),
  },
  Order: {
    create: (...args: unknown[]) => mockOrderCreate(...args),
    findOne: (...args: unknown[]) => mockOrderFindOne(...args),
  },
}));

vi.mock('@/shared/ids', () => ({
  createUserId: () => '8c9e6679-7425-40de-944b-e07fc1f90ae8',
}));

import { createOrderFromCartForBuyer } from '@/domains/commerce/application/orders/create-order-from-cart';

const buyerId = '550e8400-e29b-41d4-a716-446655440000';
const sellerId = '660e8400-e29b-41d4-a716-446655440001';
const productId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

const buyerProfile = {
  firstName: 'Ali',
  lastName: 'Veli',
  phone: '+905551112233',
  country: 'Türkiye',
  city: 'İstanbul',
  deliveryAddress: 'Kadıköy Mah. No:1',
};

const productDoc = {
  _id: productId,
  sellerId,
  categoryId: '9c9e6679-7425-40de-944b-e07fc1f90ae9',
  name: 'Kulaklık',
  price: 999,
  stock: 5,
  isActive: true,
};

const approvedSeller = {
  _id: sellerId,
  approvalStatus: 'approved',
  iyzicoSubMerchantKey: 'sub-merchant-key',
};

describe('createOrderFromCartForBuyer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuyerFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(buyerProfile),
    });
    mockSellerFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([approvedSeller]),
      }),
    });
    mockWithTransaction.mockImplementation(async (callback: () => Promise<void>) => {
      await callback();
    });
    mockReservePendingOrderStock.mockResolvedValue(true);
    mockCancelPendingOrder.mockResolvedValue(true);
    mockRestoreCartItemsForBuyer.mockResolvedValue(undefined);
  });

  it('sepet boşsa 400 fırlatır', async () => {
    mockCartFindOneAndUpdate.mockResolvedValue(null);

    await expect(createOrderFromCartForBuyer(buyerId)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Sepet boş',
    });
  });

  it('sipariş oluşturur ve stok rezerve eder', async () => {
    mockCartFindOneAndUpdate.mockResolvedValue({
      items: [{ productId, quantity: 2 }],
    });
    mockAssertPurchasableCatalogProduct.mockResolvedValue(productDoc);
    mockOrderCreate.mockResolvedValue([
      {
        toObject: () => ({
          _id: orderId,
          buyerId,
          items: [
            {
              productId,
              sellerId,
              name: 'Kulaklık',
              price: 999,
              quantity: 2,
              subtotal: 1998,
              fulfillmentStatus: 'pending',
            },
          ],
          totalAmount: 1998,
          currency: 'TRY',
          status: 'pending',
          shippingAddress: {
            firstName: 'Ali',
            lastName: 'Veli',
            phone: '+905551112233',
            country: 'Türkiye',
            city: 'İstanbul',
            address: 'Kadıköy Mah. No:1',
          },
        }),
      },
    ]);

    const result = await createOrderFromCartForBuyer(buyerId);

    expect(mockReservePendingOrderStock).toHaveBeenCalled();
    expect(result.totalAmount).toBe(1998);
  });

  it('stok rezervasyonu başarısız olursa siparişi iptal eder ve sepeti geri yükler', async () => {
    mockCartFindOneAndUpdate.mockResolvedValue({
      items: [{ productId, quantity: 2 }],
    });
    mockAssertPurchasableCatalogProduct.mockResolvedValue(productDoc);
    mockOrderCreate.mockResolvedValue([
      {
        toObject: () => ({
          _id: orderId,
          buyerId,
          items: [{ productId, sellerId, name: 'Kulaklık', price: 999, quantity: 2, subtotal: 1998, fulfillmentStatus: 'pending' }],
          totalAmount: 1998,
          currency: 'TRY',
          status: 'pending',
          shippingAddress: {
            firstName: 'Ali',
            lastName: 'Veli',
            phone: '+905551112233',
            country: 'Türkiye',
            city: 'İstanbul',
            address: 'Kadıköy Mah. No:1',
          },
        }),
      },
    ]);
    mockReservePendingOrderStock.mockRejectedValue({
      statusCode: 400,
      message: 'Yetersiz stok',
    });

    await expect(createOrderFromCartForBuyer(buyerId)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Yetersiz stok',
    });

    expect(mockCancelPendingOrder).toHaveBeenCalledWith(orderId);
    expect(mockRestoreCartItemsForBuyer).toHaveBeenCalledWith(buyerId, [
      { productId, quantity: 2, priceSnapshot: null },
    ]);
  });

  it('fiyat değiştiyse acceptPriceChanges olmadan 409 fırlatır', async () => {
    mockCartFindOneAndUpdate.mockResolvedValue({
      items: [{ productId, quantity: 2, priceSnapshot: 899 }],
    });
    mockAssertPurchasableCatalogProduct.mockResolvedValue({ ...productDoc, price: 999 });

    await expect(
      createOrderFromCartForBuyer(buyerId, { acceptPriceChanges: false })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Sepette fiyat değişikliği var',
    });
  });

  it('fiyat değiştiyse acceptPriceChanges true ile sipariş oluşturur', async () => {
    mockCartFindOneAndUpdate.mockResolvedValue({
      items: [{ productId, quantity: 2, priceSnapshot: 899 }],
    });
    mockAssertPurchasableCatalogProduct.mockResolvedValue({ ...productDoc, price: 999 });
    mockOrderCreate.mockResolvedValue([
      {
        toObject: () => ({
          _id: orderId,
          buyerId,
          items: [
            {
              productId,
              sellerId,
              name: 'Kulaklık',
              price: 999,
              quantity: 2,
              subtotal: 1998,
              fulfillmentStatus: 'pending',
            },
          ],
          totalAmount: 1998,
          currency: 'TRY',
          status: 'pending',
          shippingAddress: {
            firstName: 'Ali',
            lastName: 'Veli',
            phone: '+905551112233',
            country: 'Türkiye',
            city: 'İstanbul',
            address: 'Kadıköy Mah. No:1',
          },
        }),
      },
    ]);

    const result = await createOrderFromCartForBuyer(buyerId, { acceptPriceChanges: true });

    expect(result.totalAmount).toBe(1998);
  });
});
