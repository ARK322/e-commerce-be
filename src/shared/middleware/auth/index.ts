export { requireAuth } from '@/shared/middleware/auth/require-auth';
export { requireEmailVerified } from '@/shared/middleware/auth/require-email-verified';
export {
  requireAdmin,
  requireAllPermissions,
  requireOwner,
  requirePermission,
} from '@/shared/middleware/auth/require-admin';
export {
  requireScope,
  requireAllScopes,
  authorize,
  type AuthorizeOptions,
} from '@/shared/middleware/auth/require-scope';
