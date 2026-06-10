import { FastifyReply, FastifyRequest } from 'fastify';

export const requireOwner = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.adminRole) {
    return reply.status(403).send({ message: 'Admin profili bulunamadı' });
  }

  if (request.adminRole !== 'owner') {
    return reply.status(403).send({ message: 'Bu işlem için owner yetkisi gerekli' });
  }
};
