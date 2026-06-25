import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { countPendingOutboxEventsLean } from '@/repositories/common/outbox-event.repository';

export const registerHealthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/health', async (_req, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  app.get('/ready', async (_req, reply) => {
    const mongoReady = mongoose.connection.readyState === 1;

    if (!mongoReady) {
      return reply.status(503).send({ status: 'not_ready', mongo: false });
    }

    const outboxPending = await countPendingOutboxEventsLean();

    return reply.status(200).send({
      status: 'ready',
      mongo: true,
      outboxPending,
    });
  });
};
