import type { FastifyInstance } from 'fastify';
import {
  AUTH_ADMIN_RATE_LIMIT,
  AUTH_AUTHENTICATED_RATE_LIMIT,
  AUTH_LOGIN_RATE_LIMIT,
  AUTH_RECOVERY_RATE_LIMIT,
  AUTH_REGISTER_RATE_LIMIT,
  AUTH_SELLER_RATE_LIMIT,
} from '@/shared/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/shared/plugins/rate-limit/register-scoped';
import registerRoutes from '@/api/auth/register/register.routes';
import loginRoutes from '@/api/auth/login/login.routes';
import logoutRoutes from '@/api/auth/logout/logout.routes';
import changePasswordRoutes from '@/api/auth/change-password/change-password.routes';
import verifyEmailRoutes from '@/api/auth/verify-email/verify-email.routes';
import resendVerificationRoutes from '@/api/auth/resend-verification/resend-verification.routes';
import forgotPasswordRoutes from '@/api/auth/forgot-password/forgot-password.routes';
import resetPasswordRoutes from '@/api/auth/reset-password/reset-password.routes';
import meRoutes from '@/api/auth/me/me.routes';
import profileRoutes from '@/api/buyer/profile/profile.routes';
import documentsRoutes from '@/api/seller/documents/documents.routes';
import adminRoutes from '@/api/admin/admin.routes';
import sellersRoutes from '@/api/seller/sellers.routes';

export const registerAuthRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (authScope) => {
    await authScope.register(async (registerScope) => {
      await registerScopedRateLimit(registerScope, AUTH_REGISTER_RATE_LIMIT);
      await registerScope.register(registerRoutes, { prefix: '/register' });
    });

    await authScope.register(async (loginScope) => {
      await registerScopedRateLimit(loginScope, AUTH_LOGIN_RATE_LIMIT);
      await loginScope.register(loginRoutes, { prefix: '/login' });
    });

    await authScope.register(async (recoveryScope) => {
      await registerScopedRateLimit(recoveryScope, AUTH_RECOVERY_RATE_LIMIT);
      await recoveryScope.register(verifyEmailRoutes, { prefix: '/verify-email' });
      await recoveryScope.register(forgotPasswordRoutes, { prefix: '/forgot-password' });
      await recoveryScope.register(resetPasswordRoutes, { prefix: '/reset-password' });
      await recoveryScope.register(resendVerificationRoutes, { prefix: '/resend-verification' });
    });

    await authScope.register(async (authenticatedAuth) => {
      await registerScopedRateLimit(authenticatedAuth, AUTH_AUTHENTICATED_RATE_LIMIT);

      await authenticatedAuth.register(meRoutes, { prefix: '/me' });
      await authenticatedAuth.register(profileRoutes, { prefix: '/profile' });
      await authenticatedAuth.register(documentsRoutes, { prefix: '/profile/documents' });
      await authenticatedAuth.register(changePasswordRoutes, { prefix: '/change-password' });
      await authenticatedAuth.register(logoutRoutes, { prefix: '/logout' });
    });

    await authScope.register(async (adminScope) => {
      await registerScopedRateLimit(adminScope, AUTH_ADMIN_RATE_LIMIT);
      await adminScope.register(adminRoutes, { prefix: '/admin' });
    });

    await authScope.register(async (sellerScope) => {
      await registerScopedRateLimit(sellerScope, AUTH_SELLER_RATE_LIMIT);
      await sellerScope.register(sellersRoutes, { prefix: '/seller' });
    });
  }, { prefix: '/auth' });
};
