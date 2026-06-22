import type { FastifyInstance } from 'fastify';
import buyersRoutes from '@/features/buyers/buyers.routes';

export const registerBuyerRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(buyersRoutes);
};
