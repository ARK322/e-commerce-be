import { Schema, model } from 'mongoose';

export const OUTBOX_EVENT_STATUSES = ['pending', 'processing', 'processed', 'failed'] as const;
export type OutboxEventStatus = (typeof OUTBOX_EVENT_STATUSES)[number];

const outboxEventSchema = new Schema(
  {
    _id: { type: String, required: true },
    eventType: { type: String, required: true, trim: true, maxlength: 128 },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: OUTBOX_EVENT_STATUSES, default: 'pending' },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: null, maxlength: 2000 },
    processedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

outboxEventSchema.index({ status: 1, createdAt: 1 });
outboxEventSchema.index({ eventType: 1, createdAt: -1 });

export const OutboxEvent = model('OutboxEvent', outboxEventSchema);
