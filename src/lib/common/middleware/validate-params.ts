import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodSchema } from 'zod';

export const validateParams = <T extends ZodSchema>(schema: T) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = schema.safeParse(request.params);

    if (!parsed.success) {
      return reply.status(400).send({
        message: 'Geçersiz adres parametresi',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    request.params = parsed.data;
  };
};
