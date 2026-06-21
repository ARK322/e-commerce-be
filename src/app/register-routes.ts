import type { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from '@/app/register-auth-routes';
import { registerHealthRoutes } from '@/app/health.routes';
import catalogRoutes from '@/features/catalog/catalog.routes';
import buyersRoutes from '@/features/buyers/buyers.routes';

export const registerRoutes = async (app: FastifyInstance): Promise<void> => {
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await app.register(catalogRoutes);
  await app.register(buyersRoutes);
};
