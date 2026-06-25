import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

const REQUEST_ID_HEADER = 'x-request-id';

export const registerRequestId = (app: FastifyInstance): void => {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const incoming = request.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof incoming === 'string' && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

    request.id = requestId;
    reply.header(REQUEST_ID_HEADER, requestId);
  });
};
