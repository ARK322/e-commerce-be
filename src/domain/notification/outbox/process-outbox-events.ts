import { env } from '@/config/env';
import {
  sendSellerApprovedEmail,
  sendSellerRejectedEmail,
} from '@/domain/auth/admin/mail/send-seller-notifications';
import { sendOrderConfirmationEmail } from '@/domain/orders/mail/send-order-confirmation';
import {
  sendOrderDeliveredEmail,
  sendOrderShippedEmail,
  sendReturnRequestedEmail,
  sendReturnResolvedEmail,
} from '@/domain/orders/mail/send-order-status-emails';
import { logger } from '@/shared/logging';
import { OUTBOX_EVENT_TYPES } from '@/domain/notification/outbox/enqueue-outbox-event';
import { sendOpsAlertEmail } from '@/domain/notification/outbox/send-ops-alert-email';
import {
  claimPendingOutboxEvent,
  markOutboxEventFailed,
  markOutboxEventProcessed,
} from '@/repositories/common/outbox-event.repository';

const BATCH_SIZE = 20;

const processOutboxEvent = async (event: {
  _id: unknown;
  eventType: string;
  payload: Record<string, unknown>;
  attempts: number;
}): Promise<void> => {
  const eventId = String(event._id);
  const attempts = (event.attempts ?? 0) + 1;

  try {
    if (event.eventType === OUTBOX_EVENT_TYPES.EMAIL_SELLER_APPROVED) {
      const email = String(event.payload.email ?? '');
      const companyName = String(event.payload.companyName ?? '');
      await sendSellerApprovedEmail(email, companyName);
    } else if (event.eventType === OUTBOX_EVENT_TYPES.EMAIL_SELLER_REJECTED) {
      const email = String(event.payload.email ?? '');
      const reason = String(event.payload.reason ?? '');
      const companyName = String(event.payload.companyName ?? '');
      await sendSellerRejectedEmail(email, reason, companyName);
    } else if (event.eventType === OUTBOX_EVENT_TYPES.EMAIL_ORDER_CONFIRMATION) {
      const email = String(event.payload.email ?? '');
      const orderId = String(event.payload.orderId ?? '');
      const totalAmount = Number(event.payload.totalAmount ?? 0);
      const currency = String(event.payload.currency ?? 'TRY');
      await sendOrderConfirmationEmail(email, orderId, totalAmount, currency);
    } else if (event.eventType === OUTBOX_EVENT_TYPES.EMAIL_ORDER_SHIPPED) {
      const email = String(event.payload.email ?? '');
      const orderId = String(event.payload.orderId ?? '');
      const trackingNumber = String(event.payload.trackingNumber ?? '');
      const carrier = String(event.payload.carrier ?? '');
      await sendOrderShippedEmail(email, orderId, trackingNumber, carrier);
    } else if (event.eventType === OUTBOX_EVENT_TYPES.EMAIL_ORDER_DELIVERED) {
      const email = String(event.payload.email ?? '');
      const orderId = String(event.payload.orderId ?? '');
      await sendOrderDeliveredEmail(email, orderId);
    } else if (event.eventType === OUTBOX_EVENT_TYPES.EMAIL_RETURN_REQUESTED) {
      const email = String(event.payload.email ?? '');
      const orderId = String(event.payload.orderId ?? '');
      const requestId = String(event.payload.requestId ?? '');
      await sendReturnRequestedEmail(email, orderId, requestId);
    } else if (event.eventType === OUTBOX_EVENT_TYPES.EMAIL_RETURN_RESOLVED) {
      const email = String(event.payload.email ?? '');
      const orderId = String(event.payload.orderId ?? '');
      const status = String(event.payload.status ?? '');
      await sendReturnResolvedEmail(email, orderId, status);
    } else if (
      event.eventType === OUTBOX_EVENT_TYPES.OPS_PAYMENT_SIDE_EFFECTS_FAILED ||
      event.eventType === OUTBOX_EVENT_TYPES.OPS_PAYMENT_SPLIT_APPROVAL_FAILED
    ) {
      logger.error(
        {
          eventType: event.eventType,
          payload: event.payload,
        },
        'Operasyon uyarısı işlendi — manuel müdahale gerekebilir'
      );
      await sendOpsAlertEmail(event.eventType, event.payload);
    } else {
      throw new Error(`Unsupported outbox event type: ${event.eventType}`);
    }

    await markOutboxEventProcessed(eventId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markOutboxEventFailed(eventId, message, attempts);
    throw error;
  }
};

export const processPendingOutboxEvents = async (): Promise<number> => {
  let processedCount = 0;

  for (let index = 0; index < BATCH_SIZE; index += 1) {
    const event = await claimPendingOutboxEvent();

    if (!event) {
      break;
    }

    try {
      await processOutboxEvent({
        _id: event._id,
        eventType: event.eventType,
        payload: event.payload as Record<string, unknown>,
        attempts: event.attempts ?? 0,
      });
      processedCount += 1;
    } catch (error) {
      logger.warn(
        { err: error, eventId: event._id, eventType: event.eventType },
        'Outbox event işlenemedi'
      );
    }
  }

  return processedCount;
};

export const startOutboxProcessorScheduler = (): void => {
  if (env.nodeEnv === 'test') {
    return;
  }

  const run = () => {
    void processPendingOutboxEvents()
      .then((count) => {
        if (count > 0) {
          logger.info({ count }, 'Outbox eventleri işlendi');
        }
      })
      .catch((error) => {
        logger.error({ err: error }, 'Outbox işleyici hatası');
      });
  };

  run();
  setInterval(run, 60_000);
};
