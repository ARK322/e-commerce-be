import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';

export const registerHealthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/health', async (_req, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  app.get('/ready', async (_req, reply) => {
    const mongoReady = mongoose.connection.readyState === 1;

    if (!mongoReady) {
      return reply.status(503).send({ status: 'not_ready', mongo: false });
    }

    return reply.status(200).send({ status: 'ready', mongo: true });
  });
};
