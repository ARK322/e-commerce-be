import { z } from 'zod';
import { RETURN_REQUEST_STATUSES } from '@/infrastructure/mongo';
import { safeString } from '@/shared/validation/common-schemas';

export const listReturnRequestsQuerySchema = z.object({
  status: z.enum(RETURN_REQUEST_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewReturnRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  adminNote: safeString({ min: 3, max: 2000, label: 'Admin notu' }).optional(),
});

export type ListReturnRequestsQuery = z.infer<typeof listReturnRequestsQuerySchema>;
export type ReviewReturnRequestInput = z.infer<typeof reviewReturnRequestSchema>;
