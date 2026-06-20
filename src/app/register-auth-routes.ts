import type { FastifyInstance } from 'fastify';
import {
  AUTH_ADMIN_RATE_LIMIT,
  AUTH_AUTHENTICATED_RATE_LIMIT,
  AUTH_PUBLIC_RATE_LIMIT,
  AUTH_SELLER_RATE_LIMIT,
} from '@/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/plugins/rate-limit/register-scoped';
import registerRoutes from '@/features/identity/register/register.routes';
import loginRoutes from '@/features/identity/login/login.routes';
import logoutRoutes from '@/features/identity/logout/logout.routes';
import changePasswordRoutes from '@/features/identity/change-password/change-password.routes';
import verifyEmailRoutes from '@/features/identity/verify-email/verify-email.routes';
import resendVerificationRoutes from '@/features/identity/resend-verification/resend-verification.routes';
import forgotPasswordRoutes from '@/features/identity/forgot-password/forgot-password.routes';
import resetPasswordRoutes from '@/features/identity/reset-password/reset-password.routes';
import meRoutes from '@/features/identity/me/me.routes';
import profileRoutes from '@/features/buyers/profile/profile.routes';
import documentsRoutes from '@/features/sellers/documents/documents.routes';
import adminRoutes from '@/features/admin/admin.routes';
import sellersRoutes from '@/features/sellers/sellers.routes';

export const registerAuthRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (authScope) => {
    await authScope.register(async (publicAuth) => {
      await registerScopedRateLimit(publicAuth, AUTH_PUBLIC_RATE_LIMIT);

      await publicAuth.register(registerRoutes, { prefix: '/register' });
      await publicAuth.register(loginRoutes, { prefix: '/login' });
      await publicAuth.register(verifyEmailRoutes, { prefix: '/verify-email' });
      await publicAuth.register(forgotPasswordRoutes, { prefix: '/forgot-password' });
      await publicAuth.register(resetPasswordRoutes, { prefix: '/reset-password' });
      await publicAuth.register(resendVerificationRoutes, { prefix: '/resend-verification' });
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
