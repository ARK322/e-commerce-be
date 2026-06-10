import { FastifyReply, FastifyRequest } from 'fastify';
import { getAdminRole } from '../admin-role';

declare module 'fastify' {
  interface FastifyRequest {
    adminRole?: 'owner' | 'helper';
  }
}

export const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.auth) {
    return reply.status(401).send({ message: 'Giriş gerekli' });
  }

  if (request.auth.role !== 'admin') {
    return reply.status(403).send({ message: 'Bu işlem için admin yetkisi gerekli' });
  }

  const adminRole = await getAdminRole(request.auth.userId);

  if (!adminRole) {
    return reply.status(403).send({ message: 'Admin profili bulunamadı' });
  }

  request.adminRole = adminRole;
};
