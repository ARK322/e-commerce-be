import { z } from 'zod';
import { uuidSchema } from '@/internal/common/validation/common-schemas';

export const listPaymentAuditLogsQuerySchema = z.object({
  orderId: uuidSchema.optional(),
  paymentId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListPaymentAuditLogsQuery = z.infer<typeof listPaymentAuditLogsQuerySchema>;
