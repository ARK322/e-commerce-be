import { FastifyReply } from 'fastify';
import { HttpError, isDuplicateKeyError } from '@/internal/common/errors';
import { CommerceError } from '@/internal/common/errors/commerce-error';
import { logger } from '@/internal/common/logging';

type HandleRouteErrorOptions = {
  duplicateKeyMessage?: string;
  duplicateKeyStatusCode?: number;
};

export const handleRouteError = (
  reply: FastifyReply,
  error: unknown,
  fallbackMessage: string,
  options?: HandleRouteErrorOptions
) => {
  if (error instanceof HttpError) {
    const payload: Record<string, unknown> = { message: error.message };

    if (error instanceof CommerceError && error.details !== undefined) {
      payload.details = error.details;
    }

    return reply.status(error.statusCode).send(payload);
  }

  if (options?.duplicateKeyMessage && isDuplicateKeyError(error)) {
    return reply
      .status(options.duplicateKeyStatusCode ?? 409)
      .send({ message: options.duplicateKeyMessage });
  }

  logger.error({ err: error }, fallbackMessage);

  return reply.status(500).send({ message: fallbackMessage });
};
