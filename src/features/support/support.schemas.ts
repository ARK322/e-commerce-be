import { z } from 'zod';
import { SUPPORT_TICKET_CATEGORIES } from '@/infrastructure/mongo';
import { safeString, uuidSchema } from '@/shared/validation/common-schemas';

export const createSupportTicketSchema = z.object({
  subject: safeString({ min: 3, max: 200, label: 'Konu' }),
  category: z.enum(SUPPORT_TICKET_CATEGORIES),
  orderId: uuidSchema.optional(),
  body: safeString({ min: 1, max: 5000, label: 'Mesaj' }),
});

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;

export const postSupportMessageSchema = z.object({
  body: safeString({ min: 1, max: 5000, label: 'Mesaj' }),
});

export type PostSupportMessageInput = z.infer<typeof postSupportMessageSchema>;

export const adminPostSupportMessageSchema = postSupportMessageSchema.extend({
  isInternal: z.boolean().optional().default(false),
});

export type AdminPostSupportMessageInput = z.infer<typeof adminPostSupportMessageSchema>;
