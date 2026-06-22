import { FastifyReply, FastifyRequest } from 'fastify';
import type { ZodSchema } from 'zod';
import { sanitizeRequestBody } from '@/shared/validation/sanitize';
import type { UserRole } from '@/domain/auth/tokens/access-token';

type RoleBodySchemas = Partial<Record<UserRole, ZodSchema>> & {
  buyer: ZodSchema;
  seller: ZodSchema;
};

type ValidateBodyByRoleOptions = {
  schemas: RoleBodySchemas;
  rejectAdmin?: boolean;
  adminMessage?: string;
};

export const validateBodyByRole =
  ({
    schemas,
    rejectAdmin = false,
    adminMessage = 'Admin profili /auth/admin/profile üzerinden yönetilir',
  }: ValidateBodyByRoleOptions) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    const role = request.auth?.role;

    if (!role) {
      return reply.status(401).send({ message: 'Giriş gerekli' });
    }

    if (rejectAdmin && role === 'admin') {
      return reply.status(403).send({ message: adminMessage });
    }

    const schema = schemas[role];

    if (!schema) {
      return reply.status(403).send({ message: 'Bu işlem için yetkin yok' });
    }

    const parsed = schema.safeParse(sanitizeRequestBody(request.body));

    if (!parsed.success) {
      return reply.status(400).send({
        message: 'Geçersiz istek verisi',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    request.body = parsed.data;
  };
