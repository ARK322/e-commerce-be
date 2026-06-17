import { z } from 'zod';
import { uuidSchema } from '@/lib/common/validation/common-schemas';

export const linkCategorySchema = z
  .object({
    parentId: uuidSchema.optional(),
    childId: uuidSchema.optional(),
  })
  .refine((data) => data.parentId !== undefined || data.childId !== undefined, {
    message: 'parentId veya childId gerekli',
  })
  .refine((data) => !(data.parentId && data.childId), {
    message: 'Tek seferde yalnızca parentId veya childId gönderilebilir',
  });

export type LinkCategoryInput = z.infer<typeof linkCategorySchema>;
