import { FastifyReply } from 'fastify';
import { HttpError, isDuplicateKeyError } from '@/internal/errors';

type HandleRouteErrorOptions = {
  duplicateKeyMessage?: string;
};

export const handleRouteError = (
  reply: FastifyReply,
  error: unknown,
  fallbackMessage: string,
  options?: HandleRouteErrorOptions
) => {
  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }

  if (options?.duplicateKeyMessage && isDuplicateKeyError(error)) {
    return reply.status(409).send({ message: options.duplicateKeyMessage });
  }

  return reply.status(500).send({ message: fallbackMessage });
};
