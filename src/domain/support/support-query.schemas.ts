import { z } from 'zod';
import { SUPPORT_TICKET_STATUSES } from '@/infrastructure/mongo';
import { uuidSchema } from '@/shared/validation/common-schemas';

export const listSupportTicketsQuerySchema = z.object({
  status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
  orderId: uuidSchema.optional(),
  assignedAdminId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListSupportTicketsQuery = z.infer<typeof listSupportTicketsQuerySchema>;

export const listSupportMessagesQuerySchema = z.object({
  since: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListSupportMessagesQuery = z.infer<typeof listSupportMessagesQuerySchema>;

export const updateSupportTicketSchema = z
  .object({
    status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
    assignedAdminId: uuidSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'En az bir alan güncellenmeli',
  });

export type UpdateSupportTicketInput = z.infer<typeof updateSupportTicketSchema>;
