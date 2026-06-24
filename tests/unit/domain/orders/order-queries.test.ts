import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateOrderFromCartForBuyer = vi.fn();
const mockListBuyerOrdersLean = vi.fn();
const mockFindBuyerOrder = vi.fn();
const mockListOrderShipments = vi.fn();

vi.mock('@/domain/orders/create-order-from-cart', () => ({
  createOrderFromCartForBuyer: (...args: unknown[]) => mockCreateOrderFromCartForBuyer(...args),
}));

vi.mock('@/domain/orders/shipment', () => ({
  listOrderShipments: (...args: unknown[]) => mockListOrderShipments(...args),
  listSellerOrderShipments: vi.fn().mockResolvedValue([]),
  createSellerShipment: vi.fn(),
}));

vi.mock('@/repositories/buyers/order.repository', () => ({
  findBuyerOrder: (...args: unknown[]) => mockFindBuyerOrder(...args),
  listBuyerOrdersLean: (...args: unknown[]) => mockListBuyerOrdersLean(...args),
  findSellerOrderLean: vi.fn(),
  listSellerOrdersLean: vi.fn().mockResolvedValue([]),
  findOrderByIdLean: vi.fn(),
}));

import {
  createOrderFromCartResponse,
  getBuyerOrderByIdWithShipments,
  listBuyerOrdersResponse,
} from '@/domain/orders/order-queries';

const buyerId = '550e8400-e29b-41d4-a716-446655440000';
const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

describe('order-queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createOrderFromCartResponse domain sonucunu map eder', async () => {
    mockCreateOrderFromCartForBuyer.mockResolvedValue({
      _id: orderId,
      buyerId,
      items: [],
      totalAmount: 100,
      currency: 'TRY',
      status: 'pending',
      shippingAddress: {
        firstName: 'Ali',
        lastName: 'Veli',
        phone: '+905551112233',
        country: 'Türkiye',
        city: 'İstanbul',
        address: 'Kadıköy',
      },
    });

    const result = await createOrderFromCartResponse(buyerId, { addressId: 'addr-1' });

    expect(mockCreateOrderFromCartForBuyer).toHaveBeenCalledWith(buyerId, {
      acceptPriceChanges: false,
      addressId: 'addr-1',
    });
    expect(result.id).toBe(orderId);
  });

  it('getBuyerOrderByIdWithShipments kargo bilgisini ekler', async () => {
    mockFindBuyerOrder.mockResolvedValue({
      _id: orderId,
      buyerId,
      items: [],
      totalAmount: 100,
      currency: 'TRY',
      status: 'paid',
      shippingAddress: {
        firstName: 'Ali',
        lastName: 'Veli',
        phone: '+905551112233',
        country: 'Türkiye',
        city: 'İstanbul',
        address: 'Kadıköy',
      },
    });
    mockListOrderShipments.mockResolvedValue([{ id: 'ship-1', trackingNumber: 'TRK1' }]);

    const result = await getBuyerOrderByIdWithShipments(buyerId, orderId);

    expect(result.shipments).toHaveLength(1);
    expect(result.id).toBe(orderId);
  });

  it('listBuyerOrdersResponse sipariş listesini map eder', async () => {
    mockListBuyerOrdersLean.mockResolvedValue([
      {
        _id: orderId,
        buyerId,
        items: [],
        totalAmount: 100,
        currency: 'TRY',
        status: 'paid',
        shippingAddress: {
          firstName: 'Ali',
          lastName: 'Veli',
          phone: '+905551112233',
          country: 'Türkiye',
          city: 'İstanbul',
          address: 'Kadıköy',
        },
      },
    ]);

    const result = await listBuyerOrdersResponse(buyerId);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(orderId);
  });
});
