import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { verifyAuthToken, type AuthTokenPayload } from '../../auth/auth-token';
import { isTokenRevoked } from '../../auth/revoked-token';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthTokenPayload;
    authToken?: string;
  }
}

export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return reply.status(401).send({ message: 'Giriş gerekli' });
  }

  const token = header.slice(7);

  try {
    if (await isTokenRevoked(token)) {
      return reply.status(401).send({ message: 'Oturum sonlandırıldı, tekrar giriş yapın' });
    }

    request.auth = verifyAuthToken(token);
    request.authToken = token;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({ message: 'Oturum süresi doldu, tekrar giriş yapın' });
    }

    return reply.status(401).send({ message: 'Geçersiz token' });
  }
};
