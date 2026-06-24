import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindOrderByIdLean = vi.fn();
const mockCreateShipment = vi.fn();
const mockListShipmentsByOrder = vi.fn();
const mockFindBuyerProfile = vi.fn();
const mockEnqueueOutbox = vi.fn();

vi.mock('@/repositories/buyers/order.repository', () => ({
  findOrderByIdLean: (...args: unknown[]) => mockFindOrderByIdLean(...args),
}));

vi.mock('@/repositories/orders/shipment.repository', () => ({
  createShipment: (...args: unknown[]) => mockCreateShipment(...args),
  listShipmentsByOrderIdLean: (...args: unknown[]) => mockListShipmentsByOrder(...args),
  listShipmentsByOrderAndSellerLean: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/repositories/buyers/buyer.repository', () => ({
  findBuyerPaymentProfileLean: (...args: unknown[]) => mockFindBuyerProfile(...args),
}));

vi.mock('@/domain/notification/outbox/enqueue-outbox-event', () => ({
  enqueueOutboxEvent: (...args: unknown[]) => mockEnqueueOutbox(...args),
  OUTBOX_EVENT_TYPES: {
    EMAIL_ORDER_SHIPPED: 'email.order.shipped',
  },
}));

vi.mock('@/shared/ids', () => ({
  createUserId: () => 'shipment-id',
}));

import { createSellerShipment } from '@/domain/orders/shipment';
import { CommerceError } from '@/shared/errors/commerce-error';

const sellerId = '660e8400-e29b-41d4-a716-446655440001';
const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';
const buyerId = '550e8400-e29b-41d4-a716-446655440000';

describe('createSellerShipment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindBuyerProfile.mockResolvedValue({ user: { email: 'buyer@test.com' } });
    mockCreateShipment.mockResolvedValue({
      _id: 'shipment-id',
      orderId,
      sellerId,
      productIds: ['p1'],
      trackingNumber: 'TRK123',
      carrier: 'yurtici',
      status: 'shipped',
      notes: null,
      shippedAt: new Date(),
      deliveredAt: null,
      createdAt: new Date(),
    });
  });

  it('ödenmiş siparişe kargo kaydı oluşturur ve email outboxa yazar', async () => {
    mockFindOrderByIdLean.mockResolvedValue({
      _id: orderId,
      buyerId,
      status: 'paid',
      items: [{ sellerId, productId: 'p1', quantity: 1 }],
    });

    const result = await createSellerShipment(sellerId, orderId, {
      trackingNumber: 'TRK123',
      carrier: 'yurtici',
    });

    expect(result.trackingNumber).toBe('TRK123');
    expect(mockCreateShipment).toHaveBeenCalled();
    expect(mockEnqueueOutbox).toHaveBeenCalledWith(
      'email.order.shipped',
      expect.objectContaining({ orderId, trackingNumber: 'TRK123' })
    );
  });

  it('bekleyen siparişe kargo eklenemez', async () => {
    mockFindOrderByIdLean.mockResolvedValue({
      _id: orderId,
      buyerId,
      status: 'pending',
      items: [{ sellerId, productId: 'p1', quantity: 1 }],
    });

    await expect(
      createSellerShipment(sellerId, orderId, {
        trackingNumber: 'TRK123',
        carrier: 'yurtici',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('satıcıya ait olmayan ürün kalemi reddedilir', async () => {
    mockFindOrderByIdLean.mockResolvedValue({
      _id: orderId,
      buyerId,
      status: 'paid',
      items: [{ sellerId, productId: 'p1', quantity: 1 }],
    });

    await expect(
      createSellerShipment(sellerId, orderId, {
        trackingNumber: 'TRK123',
        carrier: 'yurtici',
        productIds: ['other-product'],
      })
    ).rejects.toBeInstanceOf(CommerceError);
  });
});
