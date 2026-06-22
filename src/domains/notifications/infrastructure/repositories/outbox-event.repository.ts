import { OutboxEvent } from '@/integrations/mongo';

export const createOutboxEvent = async (data: {
  _id: string;
  eventType: string;
  payload: Record<string, unknown>;
}) =>
  OutboxEvent.create({
    ...data,
    status: 'pending',
    attempts: 0,
    lastError: null,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

export const claimPendingOutboxEvent = async () =>
  OutboxEvent.findOneAndUpdate(
    { status: 'pending' },
    {
      $set: {
        status: 'processing',
        updatedAt: new Date(),
      },
    },
    { sort: { createdAt: 1 }, new: true }
  ).lean();

export const markOutboxEventProcessed = async (eventId: string) =>
  OutboxEvent.findOneAndUpdate(
    { _id: eventId, status: 'processing' },
    {
      $set: {
        status: 'processed',
        processedAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
      },
    }
  );

export const markOutboxEventFailed = async (
  eventId: string,
  errorMessage: string,
  attempts: number
) =>
  OutboxEvent.findOneAndUpdate(
    { _id: eventId, status: 'processing' },
    {
      $set: {
        status: attempts >= 5 ? 'failed' : 'pending',
        lastError: errorMessage.slice(0, 2000),
        attempts,
        updatedAt: new Date(),
      },
    }
  );

/** DLQ: kalıcı başarısız (attempts >= 5) event'leri listeler. */
export const listFailedOutboxEvents = async (limit = 100) =>
  OutboxEvent.find({ status: 'failed' })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .lean();

/** DLQ replay: başarısız bir event'i tekrar işlenmek üzere pending'e alır. */
export const requeueFailedOutboxEvent = async (eventId: string) =>
  OutboxEvent.findOneAndUpdate(
    { _id: eventId, status: 'failed' },
    {
      $set: {
        status: 'pending',
        attempts: 0,
        lastError: null,
        updatedAt: new Date(),
      },
    },
    { new: true }
  );
