import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodSchema } from 'zod';
import { sanitizeRequestBody } from '../validation/sanitize';

export const validateBody = <T extends ZodSchema>(schema: T) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sanitizedBody = sanitizeRequestBody(request.body);
    const parsed = schema.safeParse(sanitizedBody);

    if (!parsed.success) {
      return reply.status(400).send({
        message: 'Geçersiz istek verisi',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    request.body = parsed.data;
  };
};
