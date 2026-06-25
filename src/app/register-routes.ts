import type { FastifyInstance } from 'fastify';
import { registerCommerceRoutes } from '@/app/routes/register-commerce-routes';
import { registerPublicRoutes } from '@/app/routes/register-public-routes';
import { registerAuthRoutes } from '@/app/routes/register-auth-routes';
import { registerAdminRoutes } from '@/app/routes/register-admin-routes';
import { registerSellerRoutes } from '@/app/routes/register-seller-routes';

export const registerRoutes = async (app: FastifyInstance): Promise<void> => {
  await registerPublicRoutes(app);
  await registerAuthRoutes(app);
  await registerAdminRoutes(app);
  await registerSellerRoutes(app);
  await registerCommerceRoutes(app);
};
