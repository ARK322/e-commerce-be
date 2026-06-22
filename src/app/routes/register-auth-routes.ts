import type { FastifyInstance } from 'fastify';
import {
  AUTH_AUTHENTICATED_RATE_LIMIT,
  AUTH_LOGIN_RATE_LIMIT,
  AUTH_RECOVERY_RATE_LIMIT,
  AUTH_REGISTER_RATE_LIMIT,
} from '@/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/plugins/rate-limit/register-scoped';
import registerRoutes from '@/features/auth/register/register.routes';
import loginRoutes from '@/features/auth/login/login.routes';
import logoutRoutes from '@/features/auth/logout/logout.routes';
import changePasswordRoutes from '@/features/auth/change-password/change-password.routes';
import verifyEmailRoutes from '@/features/auth/verify-email/verify-email.routes';
import resendVerificationRoutes from '@/features/auth/resend-verification/resend-verification.routes';
import forgotPasswordRoutes from '@/features/auth/forgot-password/forgot-password.routes';
import resetPasswordRoutes from '@/features/auth/reset-password/reset-password.routes';
import meRoutes from '@/features/auth/me/me.routes';
import profileRoutes from '@/features/buyers/profile/profile.routes';
import documentsRoutes from '@/features/sellers/documents/documents.routes';

export const registerAuthRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(
    async (authScope) => {
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
    },
    { prefix: '/auth' }
  );
};
