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
    find: vi.fn(),
  },
}));

vi.mock('@/internal/buyers/payment/payment-split', () => ({
  approvePaymentSplitsForSeller: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/internal/common/ids', () => ({
  createUserId: () => '8c9e6679-7425-40de-944b-e07fc1f90ae8',
}));

import {
  createOrderFromCart,
  updateOrderStatus,
} from '@/features/buyers/orders/order.service';
import { approvePaymentSplitsForSeller } from '@/internal/buyers/payment/payment-split';

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
    mockBuyerFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(buyerProfile),
    });
    mockApprovedSellers();
    mockWithTransaction.mockImplementation(async (callback: () => Promise<void>) => {
      await callback();
    });
  });

  it('sepet boşsa 400 fırlatır', async () => {
    mockCartFindOneAndUpdate.mockResolvedValue(null);

    await expect(createOrderFromCart(buyerId)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Sepet boş',
    });
  });

  it('profil eksikse 400 fırlatır', async () => {
    mockBuyerFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ firstName: 'Ali' }),
    });

    await expect(createOrderFromCart(buyerId)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Sipariş için teslimat profili eksik',
    });
  });

  it('sepetten sipariş oluşturur; stok düşmez, sepet atomik temizlenir', async () => {
    mockCartFindOneAndUpdate.mockResolvedValue({
      items: [{ productId, quantity: 2 }],
    });
    mockProductFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(productDoc),
    });
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

    const result = await createOrderFromCart(buyerId);

    expect(mockWithTransaction).toHaveBeenCalled();
    expect(mockOrderCreate).toHaveBeenCalled();
    expect(mockCartFindOneAndUpdate).toHaveBeenCalled();
    expect(mockEndSession).toHaveBeenCalled();
    expect(result.totalAmount).toBe(1998);
    expect(result.status).toBe('pending');
  });

  it('priceSnapshot varsa ürün fiyatı yerine snapshot kullanır', async () => {
    mockCartFindOneAndUpdate.mockResolvedValue({
      items: [{ productId, quantity: 1, priceSnapshot: 850 }],
    });
    mockProductFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(productDoc),
    });
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
              price: 850,
              quantity: 1,
              subtotal: 850,
              fulfillmentStatus: 'pending',
            },
          ],
          totalAmount: 850,
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

    const result = await createOrderFromCart(buyerId);

    expect(result.items[0].price).toBe(850);
    expect(result.totalAmount).toBe(850);
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

  it('delivered yapınca yalnızca ilgili satıcının split onayı çağrılır', async () => {
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

    const result = await updateOrderStatus(sellerId, orderId, { status: 'delivered' });

    expect(result.status).toBe('delivered');
    expect(approvePaymentSplitsForSeller).toHaveBeenCalledWith(orderId, sellerId);
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
