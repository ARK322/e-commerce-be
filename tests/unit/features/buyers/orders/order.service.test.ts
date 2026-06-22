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
  mockCreateOrderFromCartForBuyer,
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
    mockCreateOrderFromCartForBuyer: vi.fn(),
  };
});

vi.mock('@/domain/orders/create-order-from-cart', () => ({
  createOrderFromCartForBuyer: (...args: unknown[]) => mockCreateOrderFromCartForBuyer(...args),
}));

vi.mock('@/domain/catalog/product/assert-purchasable-product', () => ({
  assertPurchasableCatalogProduct: (...args: unknown[]) =>
    mockAssertPurchasableCatalogProduct(...args),
}));

vi.mock('mongoose', () => ({
  default: {
    startSession: vi.fn().mockResolvedValue(mockSession),
  },
}));

vi.mock('@/infrastructure/mongo', () => ({
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
    find: vi.fn(),
  },
}));

vi.mock('@/domain/payment/payment-split', () => ({
  approvePaymentSplitsForSeller: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/ids', () => ({
  createUserId: () => '8c9e6679-7425-40de-944b-e07fc1f90ae8',
}));

import {
  createOrderFromCart,
  updateOrderStatus,
} from '@/features/buyers/orders/order.service';
import { approvePaymentSplitsForSeller } from '@/domain/payment/payment-split';

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

const mockApprovedSellers = () => {
  mockSellerFind.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue([approvedSeller]),
    }),
  });
};

describe('createOrderFromCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('internal sipariş oluşturucuyu çağırır ve yanıtı map eder', async () => {
    mockCreateOrderFromCartForBuyer.mockResolvedValue({
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
    });

    const result = await createOrderFromCart(buyerId);

    expect(mockCreateOrderFromCartForBuyer).toHaveBeenCalledWith(buyerId, {
      acceptPriceChanges: false,
    });
    expect(result.id).toBe(orderId);
    expect(result.totalAmount).toBe(1998);
  });

  it('internal hata fırlatırsa iletir', async () => {
    mockCreateOrderFromCartForBuyer.mockRejectedValue({
      statusCode: 400,
      message: 'Sepet boş',
    });

    await expect(createOrderFromCart(buyerId)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Sepet boş',
    });
  });
});

describe('updateOrderStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('paid siparişte satıcı kalemlerini shipped yapar', async () => {
    const orderDoc = {
      _id: orderId,
      status: 'paid',
      items: [{ sellerId, fulfillmentStatus: 'pending' }],
      save: vi.fn().mockResolvedValue(undefined),
      toObject: () => ({
        _id: orderId,
        buyerId,
        items: [{ sellerId, fulfillmentStatus: 'shipped' }],
        totalAmount: 1998,
        currency: 'TRY',
        status: 'shipped',
        shippingAddress: buyerProfile,
      }),
    };

    mockOrderFindOne.mockResolvedValue(orderDoc);

    const result = await updateOrderStatus(sellerId, orderId, { status: 'shipped' });

    expect(result.status).toBe('shipped');
    expect(orderDoc.items[0].fulfillmentStatus).toBe('shipped');
  });

  it('delivered yapınca split onayı kayıttan sonra çağrılır', async () => {
    let saveCalled = false;

    const orderDoc = {
      _id: orderId,
      status: 'shipped',
      items: [{ sellerId, fulfillmentStatus: 'shipped' }],
      save: vi.fn().mockImplementation(async () => {
        saveCalled = true;
      }),
      toObject: () => ({
        _id: orderId,
        buyerId,
        items: [{ sellerId, fulfillmentStatus: 'delivered' }],
        totalAmount: 1998,
        currency: 'TRY',
        status: 'delivered',
        shippingAddress: buyerProfile,
      }),
    };

    mockOrderFindOne.mockResolvedValue(orderDoc);
    vi.mocked(approvePaymentSplitsForSeller).mockImplementation(async () => {
      expect(saveCalled).toBe(true);
    });

    const result = await updateOrderStatus(sellerId, orderId, { status: 'delivered' });

    expect(result.status).toBe('delivered');
    expect(approvePaymentSplitsForSeller).toHaveBeenCalledWith(orderId, sellerId);
    expect(orderDoc.save).toHaveBeenCalled();
  });

  it('split onayı başarısız olursa sipariş kaydedilmiş kalır', async () => {
    const orderDoc = {
      _id: orderId,
      status: 'shipped',
      items: [{ sellerId, fulfillmentStatus: 'shipped' }],
      save: vi.fn().mockResolvedValue(undefined),
      toObject: () => ({
        _id: orderId,
        buyerId,
        items: [{ sellerId, fulfillmentStatus: 'delivered' }],
        totalAmount: 1998,
        currency: 'TRY',
        status: 'delivered',
        shippingAddress: buyerProfile,
      }),
    };

    mockOrderFindOne.mockResolvedValue(orderDoc);
    vi.mocked(approvePaymentSplitsForSeller).mockRejectedValue(new Error('iyzico down'));

    await expect(
      updateOrderStatus(sellerId, orderId, { status: 'delivered' })
    ).rejects.toThrow('iyzico down');

    expect(orderDoc.save).toHaveBeenCalled();
    expect(orderDoc.items[0].fulfillmentStatus).toBe('delivered');
  });

  it('geçersiz geçişte 400 fırlatır', async () => {
    mockOrderFindOne.mockResolvedValue({
      _id: orderId,
      status: 'pending',
      items: [{ sellerId, fulfillmentStatus: 'pending' }],
    });

    await expect(
      updateOrderStatus(sellerId, orderId, { status: 'delivered' })
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
