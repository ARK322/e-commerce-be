import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceError } from '@/shared/errors/commerce-error';

const mockFindSellerOrderForUpdate = vi.fn();
const mockSaveOrderDocument = vi.fn();
const mockApprovePaymentSplitsForSeller = vi.fn();
const mockFindBuyerPaymentProfileLean = vi.fn();
const mockEnqueueOutboxEvent = vi.fn();

vi.mock('@/repositories/buyers/order.repository', () => ({
  findSellerOrderForUpdate: (...args: unknown[]) => mockFindSellerOrderForUpdate(...args),
  saveOrderDocument: (...args: unknown[]) => mockSaveOrderDocument(...args),
}));

vi.mock('@/domain/payment/payment-split', () => ({
  approvePaymentSplitsForSeller: (...args: unknown[]) => mockApprovePaymentSplitsForSeller(...args),
}));

vi.mock('@/repositories/buyers/buyer.repository', () => ({
  findBuyerPaymentProfileLean: (...args: unknown[]) => mockFindBuyerPaymentProfileLean(...args),
}));

vi.mock('@/domain/notification/outbox/enqueue-outbox-event', () => ({
  enqueueOutboxEvent: (...args: unknown[]) => mockEnqueueOutboxEvent(...args),
  OUTBOX_EVENT_TYPES: { EMAIL_ORDER_DELIVERED: 'email.order.delivered' },
}));

import { updateSellerOrderItemStatus } from '@/domain/orders/update-fulfillment';

const sellerId = '550e8400-e29b-41d4-a716-446655440000';
const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';
const productId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const buildOrder = (fulfillmentStatus: 'pending' | 'shipped' | 'delivered' = 'pending') => ({
  buyerId: 'buyer-1',
  status: 'paid',
  items: [{ sellerId, productId, fulfillmentStatus, subtotal: 100 }],
  toObject: () => ({ id: orderId, status: 'paid' }),
});

describe('updateSellerOrderItemStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveOrderDocument.mockImplementation(async (order) => order);
    mockApprovePaymentSplitsForSeller.mockResolvedValue(undefined);
    mockFindBuyerPaymentProfileLean.mockResolvedValue({ user: { email: 'buyer@test.com' } });
    mockEnqueueOutboxEvent.mockResolvedValue(undefined);
  });

  it('pending kalemi shipped yapar', async () => {
    mockFindSellerOrderForUpdate.mockResolvedValue(buildOrder('pending'));

    const result = await updateSellerOrderItemStatus(sellerId, orderId, productId, {
      status: 'shipped',
    });

    expect(result).toBeDefined();
    expect(mockSaveOrderDocument).toHaveBeenCalled();
    expect(mockApprovePaymentSplitsForSeller).not.toHaveBeenCalled();
  });

  it('shipped kalemi delivered yapınca split onaylar', async () => {
    const order = buildOrder('shipped');
    order.status = 'shipped';
    order.items[0].fulfillmentStatus = 'shipped';
    mockFindSellerOrderForUpdate.mockResolvedValue(order);

    await updateSellerOrderItemStatus(sellerId, orderId, productId, { status: 'delivered' });

    expect(mockApprovePaymentSplitsForSeller).toHaveBeenCalledWith(orderId, sellerId);
    expect(mockEnqueueOutboxEvent).toHaveBeenCalled();
  });

  it('pending iken delivered yapılamaz', async () => {
    mockFindSellerOrderForUpdate.mockResolvedValue(buildOrder('pending'));

    await expect(
      updateSellerOrderItemStatus(sellerId, orderId, productId, { status: 'delivered' })
    ).rejects.toBeInstanceOf(CommerceError);
  });

  it('sipariş bulunamazsa 404 fırlatır', async () => {
    mockFindSellerOrderForUpdate.mockResolvedValue(null);

    await expect(
      updateSellerOrderItemStatus(sellerId, orderId, productId, { status: 'shipped' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
