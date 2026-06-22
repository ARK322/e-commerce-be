import { z } from 'zod';

export const setUserActiveStatusSchema = z.object({
  isActive: z.boolean(),
});

export type SetUserActiveStatusInput = z.infer<typeof setUserActiveStatusSchema>;
