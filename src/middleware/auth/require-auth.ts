import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { verifyAuthToken, type AuthTokenPayload } from '@/domain/auth/tokens/access-token';
import { findUserByIdLean } from '@/repositories/auth/user.repository';
import {
  isTokenIssuedBefore,
  PASSWORD_CHANGED_MESSAGE,
  SESSIONS_REVOKED_MESSAGE,
} from '@/domain/auth/tokens/invalidate-all';
import { isTokenRevoked } from '@/domain/auth/tokens/revoke-token';

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

    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    const user = await findUserByIdLean(
      request.auth.userId,
      'passwordChangedAt sessionsRevokedAt role isActive'
    );

    if (!user) {
      return reply.status(401).send({ message: 'Oturum geçersiz, tekrar giriş yapın' });
    }

    if (user.role !== request.auth.role) {
      return reply.status(401).send({ message: 'Oturum geçersiz, tekrar giriş yapın' });
    }

    if ((user.role === 'admin' || user.role === 'seller') && user.isActive === false) {
      return reply.status(403).send({ message: 'Hesap aktif değil' });
    }

    if (isTokenIssuedBefore(decoded?.iat, (user?.passwordChangedAt as Date | null | undefined) ?? null)) {
      return reply.status(401).send({ message: PASSWORD_CHANGED_MESSAGE });
    }

    if (isTokenIssuedBefore(decoded?.iat, (user?.sessionsRevokedAt as Date | null | undefined) ?? null)) {
      return reply.status(401).send({ message: SESSIONS_REVOKED_MESSAGE });
    }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({ message: 'Oturum süresi doldu, tekrar giriş yapın' });
    }

    return reply.status(401).send({ message: 'Geçersiz token' });
  }
};
