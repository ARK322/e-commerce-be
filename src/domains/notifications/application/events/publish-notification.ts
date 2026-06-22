import { env } from '@/config/env';
import { createLogger } from '@/shared/logging';
import {
  enqueueOutboxEvent,
  type OutboxEventType,
} from '@/domains/notifications/application/outbox/enqueue-outbox-event';

const log = createLogger({ module: 'notification-publisher' });

/**
 * Domain-agnostic notification publisher seam.
 *
 * Transport NOTIFICATIONS_TRANSPORT env'i ile se\u00e7ilir:
 *   - 'outbox' (default): Mongo transactional outbox \u2014 worker drain eder
 *   - 'rabbitmq': do\u011frudan broker'a publish (QUEUE_URL gerekli)
 *
 * Domain'ler her zaman bu fonksiyonu \u00e7a\u011f\u0131r\u0131r; transport de\u011fi\u015firse \u00e7a\u011f\u0131ran kod
 * etkilenmez. Monolith/test modunda outbox kullan\u0131l\u0131r.
 */
export const publishNotification = async (
  type: OutboxEventType,
  payload: Record<string, unknown>
): Promise<void> => {
  if (env.notificationsTransport === 'rabbitmq') {
    try {
      const { publishToQueue } = await import('@/integrations/queue/rabbitmq');
      await publishToQueue(type, { type, payload, occurredAt: new Date().toISOString() });
      return;
    } catch (error) {
      // Broker eri\u015filemezse transactional outbox'a d\u00fc\u015f \u2014 mesaj kaybolmaz.
      log.error({ err: error, type }, 'RabbitMQ publish ba\u015far\u0131s\u0131z, outbox fallback');
    }
  }

  await enqueueOutboxEvent(type, payload);
};

export { OUTBOX_EVENT_TYPES as NOTIFICATION_EVENTS } from '@/domains/notifications/application/outbox/enqueue-outbox-event';
export type { OutboxEventType as NotificationEventType } from '@/domains/notifications/application/outbox/enqueue-outbox-event';
