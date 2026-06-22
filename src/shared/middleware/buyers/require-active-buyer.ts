import { FastifyReply, FastifyRequest } from 'fastify';
import { findUserByIdLean } from '@/domains/identity/infrastructure/repositories/auth/user.repository';

export const requireActiveBuyer = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.auth) {
    return reply.status(401).send({ message: 'Giriş gerekli' });
  }

  if (request.auth.role !== 'buyer') {
    return reply.status(403).send({ message: 'Bu işlem için alıcı hesabı gerekli' });
  }

  const user = await findUserByIdLean(request.auth.userId, 'isActive role');

  if (!user) {
    return reply.status(401).send({ message: 'Giriş gerekli' });
  }

  if (!user.isActive) {
    return reply.status(403).send({
      message: 'Profilini tamamlamadan alışveriş yapamazsın',
    });
  }
};
