import { z } from 'zod';

export const financeReportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type FinanceReportQuery = z.infer<typeof financeReportQuerySchema>;
