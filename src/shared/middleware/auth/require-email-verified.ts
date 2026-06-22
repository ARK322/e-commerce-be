import { FastifyReply, FastifyRequest } from 'fastify';
import { findUserByIdLean } from '@/domains/identity/infrastructure/repositories/auth/user.repository';

export const requireEmailVerified = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  if (!request.auth) {
    return reply.status(401).send({ message: 'Giriş gerekli' });
  }

  const user = await findUserByIdLean(request.auth.userId, 'isEmailVerified role');

  if (!user) {
    return reply.status(401).send({ message: 'Giriş gerekli' });
  }

  if (user.role === 'admin') {
    return;
  }

  if (!user.isEmailVerified) {
    return reply.status(403).send({
      message: 'E-posta adresini doğrulamadan devam edemezsin',
    });
  }
};
