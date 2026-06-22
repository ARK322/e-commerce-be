import { Schema, model } from 'mongoose';
import { SUPPORT_AUTHOR_ROLES } from '@/infrastructure/mongo/models/support/support-ticket.model';

const supportMessageSchema = new Schema(
  {
    _id: { type: String, required: true },
    ticketId: { type: String, required: true },
    authorUserId: { type: String, required: true },
    authorRole: { type: String, enum: SUPPORT_AUTHOR_ROLES, required: true },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    isInternal: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

supportMessageSchema.index({ ticketId: 1, createdAt: 1 });

export const SupportMessage = model('SupportMessage', supportMessageSchema);
