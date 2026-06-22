import type { FastifyInstance } from 'fastify';
import { registerPublicRoutes } from '@/app/routes/register-public-routes';
import { registerAuthRoutes } from '@/app/routes/register-auth-routes';
import { registerAdminRoutes } from '@/app/routes/register-admin-routes';
import { registerSellerRoutes } from '@/app/routes/register-seller-routes';
import { registerBuyerRoutes } from '@/app/routes/register-buyer-routes';

export const registerRoutes = async (app: FastifyInstance): Promise<void> => {
  await registerPublicRoutes(app);
  await registerAuthRoutes(app);
  await registerAdminRoutes(app);
  await registerSellerRoutes(app);
  await registerBuyerRoutes(app);
};
