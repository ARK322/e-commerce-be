import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendSellerApprovedEmail = vi.fn();
const mockSendSellerRejectedEmail = vi.fn();
const mockSendOrderConfirmationEmail = vi.fn();
const mockClaimPendingOutboxEvent = vi.fn();
const mockMarkOutboxEventProcessed = vi.fn();
const mockMarkOutboxEventFailed = vi.fn();

vi.mock('@/domain/auth/admin/mail/send-seller-notifications', () => ({
  sendSellerApprovedEmail: (...args: unknown[]) => mockSendSellerApprovedEmail(...args),
  sendSellerRejectedEmail: (...args: unknown[]) => mockSendSellerRejectedEmail(...args),
}));

vi.mock('@/domain/orders/mail/send-order-confirmation', () => ({
  sendOrderConfirmationEmail: (...args: unknown[]) => mockSendOrderConfirmationEmail(...args),
}));

vi.mock('@/repositories/common/outbox-event.repository', () => ({
  claimPendingOutboxEvent: (...args: unknown[]) => mockClaimPendingOutboxEvent(...args),
  markOutboxEventProcessed: (...args: unknown[]) => mockMarkOutboxEventProcessed(...args),
  markOutboxEventFailed: (...args: unknown[]) => mockMarkOutboxEventFailed(...args),
}));

import { OUTBOX_EVENT_TYPES } from '@/domain/notification/outbox/enqueue-outbox-event';
import { processPendingOutboxEvents } from '@/domain/notification/outbox/process-outbox-events';

describe('processPendingOutboxEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendSellerApprovedEmail.mockResolvedValue(undefined);
    mockSendSellerRejectedEmail.mockResolvedValue(undefined);
    mockSendOrderConfirmationEmail.mockResolvedValue(undefined);
    mockMarkOutboxEventProcessed.mockResolvedValue(undefined);
    mockMarkOutboxEventFailed.mockResolvedValue(undefined);
  });

  it('ops payment side effects failed eventini işlenmiş olarak işaretler', async () => {
    mockClaimPendingOutboxEvent
      .mockResolvedValueOnce({
        _id: 'evt-1',
        eventType: OUTBOX_EVENT_TYPES.OPS_PAYMENT_SIDE_EFFECTS_FAILED,
        payload: { orderId: 'order-1', label: 'split_transaction_sync' },
        attempts: 0,
      })
      .mockResolvedValueOnce(null);

    const count = await processPendingOutboxEvents();

    expect(count).toBe(1);
    expect(mockMarkOutboxEventProcessed).toHaveBeenCalledWith('evt-1');
  });

  it('order confirmation eventinde buyer e-postası gönderir', async () => {
    mockClaimPendingOutboxEvent
      .mockResolvedValueOnce({
        _id: 'evt-2',
        eventType: OUTBOX_EVENT_TYPES.EMAIL_ORDER_CONFIRMATION,
        payload: {
          email: 'buyer@example.com',
          orderId: 'order-2',
          totalAmount: 1998,
          currency: 'TRY',
        },
        attempts: 0,
      })
      .mockResolvedValueOnce(null);

    const count = await processPendingOutboxEvents();

    expect(count).toBe(1);
    expect(mockSendOrderConfirmationEmail).toHaveBeenCalledWith(
      'buyer@example.com',
      'order-2',
      1998,
      'TRY'
    );
  });

  it('işleyici hata verirse failed olarak işaretler', async () => {
    mockClaimPendingOutboxEvent.mockResolvedValueOnce({
      _id: 'evt-3',
      eventType: OUTBOX_EVENT_TYPES.EMAIL_SELLER_APPROVED,
      payload: { email: 'seller@example.com', companyName: 'ACME' },
      attempts: 1,
    });
    mockSendSellerApprovedEmail.mockRejectedValue(new Error('mail down'));

    const count = await processPendingOutboxEvents();

    expect(count).toBe(0);
    expect(mockMarkOutboxEventFailed).toHaveBeenCalledWith('evt-3', 'mail down', 2);
  });
});
