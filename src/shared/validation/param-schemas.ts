import { z } from 'zod';
import { uuidSchema } from '@/shared/validation/common-schemas';

export const userIdParamSchema = z.object({
  userId: uuidSchema,
});

export const categoryIdParamSchema = z.object({
  categoryId: uuidSchema,
});

export const productIdParamSchema = z.object({
  productId: uuidSchema,
});

export const orderIdParamSchema = z.object({
  orderId: uuidSchema,
});

export const roleIdParamSchema = z.object({
  roleId: uuidSchema,
});

export const ticketIdParamSchema = z.object({
  ticketId: uuidSchema,
});
