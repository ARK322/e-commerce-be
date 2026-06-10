import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import registerRoutes from './register/register.routes';
import loginRoutes from './login/login.routes';
import profileupdateRoutes from './profileupdate/profileupdate.routes';
import changePasswordRoutes from './change-password/change-password.routes';
import logoutRoutes from './logout/logout.routes';
import verifyEmailRoutes from './verify-email/verify-email.routes';
import forgotPasswordRoutes from './forgot-password/forgot-password.routes';
import resetPasswordRoutes from './reset-password/reset-password.routes';
import resendVerificationRoutes from './resend-verification/resend-verification.routes';
import meRoutes from './me/me.routes';
import adminRoutes from './admin/admin.routes';

const PUBLIC_AUTH_RATE_LIMIT = {
  max: 10,
  timeWindow: '15 minutes',
};

const ADMIN_RATE_LIMIT = {
  max: 60,
  timeWindow: '1 minute',
};

export default async function (fastify: FastifyInstance) {
  await fastify.register(async (publicAuth) => {
    await publicAuth.register(rateLimit, PUBLIC_AUTH_RATE_LIMIT);

    await publicAuth.register(registerRoutes, { prefix: '/register' });
    await publicAuth.register(loginRoutes, { prefix: '/login' });
    await publicAuth.register(verifyEmailRoutes, { prefix: '/verify-email' });
    await publicAuth.register(forgotPasswordRoutes, { prefix: '/forgot-password' });
    await publicAuth.register(resetPasswordRoutes, { prefix: '/reset-password' });
    await publicAuth.register(resendVerificationRoutes, { prefix: '/resend-verification' });
  });

  await fastify.register(meRoutes, { prefix: '/me' });
  await fastify.register(profileupdateRoutes, { prefix: '/profile' });
  await fastify.register(changePasswordRoutes, { prefix: '/change-password' });
  await fastify.register(logoutRoutes, { prefix: '/logout' });

  await fastify.register(async (adminScope) => {
    await adminScope.register(rateLimit, ADMIN_RATE_LIMIT);
    await adminScope.register(adminRoutes, { prefix: '/admin' });
  });
}
