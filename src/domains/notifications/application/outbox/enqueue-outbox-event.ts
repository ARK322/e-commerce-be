import { createUserId } from '@/shared/ids';
import { createLogger } from '@/shared/logging';
import { createOutboxEvent } from '@/domains/notifications/infrastructure/repositories/outbox-event.repository';

const log = createLogger({ module: 'outbox' });

export const OUTBOX_EVENT_TYPES = {
  EMAIL_SELLER_APPROVED: 'email.seller.approved',
  EMAIL_SELLER_REJECTED: 'email.seller.rejected',
  EMAIL_ORDER_CONFIRMATION: 'email.order.confirmation',
  OPS_PAYMENT_SIDE_EFFECTS_FAILED: 'ops.payment.side_effects_failed',
  OPS_PAYMENT_SPLIT_APPROVAL_FAILED: 'ops.payment.split_approval_failed',
} as const;

export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[keyof typeof OUTBOX_EVENT_TYPES];

export const enqueueOutboxEvent = async (
  eventType: OutboxEventType,
  payload: Record<string, unknown>
): Promise<void> => {
  try {
    await createOutboxEvent({
      _id: createUserId(),
      eventType,
      payload,
    });
    log.info({ eventType }, 'Outbox event enqueued');
  } catch (error) {
    log.error({ err: error, eventType, payload }, 'Outbox event yazılamadı');
  }
};
