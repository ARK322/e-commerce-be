import { createLogger } from '@/shared/logging';
import { enqueueOutboxEvent, OUTBOX_EVENT_TYPES } from '@/shared/outbox/enqueue-outbox-event';

const log = createLogger({ module: 'ops-alert' });

export const enqueueOpsAlert = async (
  eventType: (typeof OUTBOX_EVENT_TYPES)[keyof typeof OUTBOX_EVENT_TYPES],
  payload: Record<string, unknown>
): Promise<void> => {
  log.error({ eventType, ...payload }, 'Operasyon uyarısı outbox kuyruğuna alındı');
  await enqueueOutboxEvent(eventType, payload);
};
