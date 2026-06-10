import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodSchema } from 'zod';
import { sanitizeRequestBody } from '../validation/sanitize';

export const validateQuery = <T extends ZodSchema>(schema: T) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sanitizedQuery = sanitizeRequestBody(request.query);
    const parsed = schema.safeParse(sanitizedQuery);

    if (!parsed.success) {
      return reply.status(400).send({
        message: 'Geçersiz sorgu parametresi',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    request.query = parsed.data;
  };
};
