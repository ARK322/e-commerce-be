import { Schema, model } from 'mongoose';

export const SUPPORT_TICKET_STATUSES = [
  'open',
  'waiting_customer',
  'waiting_seller',
  'resolved',
  'closed',
] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const SUPPORT_TICKET_CATEGORIES = [
  'order',
  'shipping',
  'product',
  'account',
  'other',
] as const;
export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];

export const SUPPORT_AUTHOR_ROLES = ['buyer', 'seller', 'admin'] as const;
export type SupportAuthorRole = (typeof SUPPORT_AUTHOR_ROLES)[number];

const supportTicketSchema = new Schema(
  {
    _id: { type: String, required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, enum: SUPPORT_TICKET_STATUSES, default: 'open' },
    category: { type: String, enum: SUPPORT_TICKET_CATEGORIES, required: true },
    orderId: { type: String, default: null },
    buyerId: { type: String, required: true },
    sellerId: { type: String, default: null },
    createdByUserId: { type: String, required: true },
    createdByRole: { type: String, enum: SUPPORT_AUTHOR_ROLES, required: true },
    assignedAdminId: { type: String, default: null },
    lastMessageAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

supportTicketSchema.index({ buyerId: 1, lastMessageAt: -1 });
supportTicketSchema.index({ sellerId: 1, lastMessageAt: -1 });
supportTicketSchema.index({ status: 1, lastMessageAt: -1 });
supportTicketSchema.index({ orderId: 1, createdAt: -1 });
supportTicketSchema.index({ assignedAdminId: 1, status: 1, lastMessageAt: -1 });

export const SupportTicket = model('SupportTicket', supportTicketSchema);
