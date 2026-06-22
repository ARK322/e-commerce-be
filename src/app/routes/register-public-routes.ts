import type { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from '@/app/health.routes';
import catalogRoutes from '@/features/catalog/catalog.routes';

export const registerPublicRoutes = async (app: FastifyInstance): Promise<void> => {
  await registerHealthRoutes(app);
  await app.register(catalogRoutes);
};
