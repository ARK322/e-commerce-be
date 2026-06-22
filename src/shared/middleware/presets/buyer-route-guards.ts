import { requireAuth } from '@/shared/middleware/auth/require-auth';
import { requireEmailVerified } from '@/shared/middleware/auth/require-email-verified';
import { requireActiveBuyer } from '@/shared/middleware/buyers/require-active-buyer';
import { validateParams } from '@/shared/middleware/validation/validate-params';
import type { ZodTypeAny } from 'zod';

export const buyerOnly = {
  preHandler: [requireAuth, requireEmailVerified, requireActiveBuyer],
};

export const buyerWithParams = (paramSchema: ZodTypeAny) => ({
  preHandler: [requireAuth, requireEmailVerified, requireActiveBuyer, validateParams(paramSchema)],
});
