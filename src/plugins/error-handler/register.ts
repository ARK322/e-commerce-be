import { FastifyInstance } from 'fastify';
import { HttpError } from '@/internal/common/errors';
import { logger } from '@/internal/common/logging';

export const registerErrorHandler = (app: FastifyInstance): void => {
  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ message: error.message });
    }

    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;

    if (statusCode >= 500) {
      logger.error({ err: error }, 'İşlenmeyen sunucu hatası');
    }

    const message =
      statusCode >= 500
        ? 'Sunucu hatası'
        : error instanceof Error
          ? error.message
          : 'İstek işlenemedi';

    reply.status(statusCode).send({ message });
  });
};
