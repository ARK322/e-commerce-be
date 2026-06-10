import { z } from 'zod';
import { objectIdSchema } from './common-schemas';

export const userIdParamSchema = z.object({
  userId: objectIdSchema,
});
