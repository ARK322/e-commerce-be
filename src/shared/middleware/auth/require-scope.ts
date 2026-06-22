import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserRole } from '@/domains/identity/application/tokens/access-token';
import { hasScope } from '@/domains/identity/application/access/scopes';

const NO_AUTH = { message: 'Giriş gerekli' };
const NO_SCOPE = { message: 'Bu işlem için yetki kapsamın yok' };
const NO_ROLE = { message: 'Bu işlem için yetkin yok' };

/**
 * Faz 3 / Aşama 2 — Scope farkında guard'lar.
 *
 * Stateless: yalnızca request.auth.scopes okunur (gateway/Identity tarafından
 * doldurulmuş). request.auth her zaman scopes içerir (verifyAuthToken legacy
 * token'larda role'den türetir), bu yüzden eski akışlar kırılmaz.
 */

/** İstenen scope'lardan EN AZ BİRİ varsa geçer (any-of). */
export const requireScope =
  (...required: string[]) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send(NO_AUTH);
    }

    const granted = request.auth.scopes ?? [];
    const allowed = required.some((scope) => hasScope(granted, scope));

    if (!allowed) {
      return reply.status(403).send(NO_SCOPE);
    }
  };

/** İstenen scope'ların TAMAMI varsa geçer (all-of). */
export const requireAllScopes =
  (...required: string[]) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send(NO_AUTH);
    }

    const granted = request.auth.scopes ?? [];
    const allowed = required.every((scope) => hasScope(granted, scope));

    if (!allowed) {
      return reply.status(403).send(NO_SCOPE);
    }
  };

export type AuthorizeOptions = {
  roles?: UserRole[];
  scopes?: string[];
  /** scope eşleşmesi: 'any' (varsayılan) veya 'all'. */
  scopeMode?: 'any' | 'all';
};

/**
 * Hibrit guard — rol ve/veya scope kontrolünü tek yerde birleştirir.
 * Örn: authorize({ roles: ['seller'], scopes: ['products:write'] })
 */
export const authorize =
  (options: AuthorizeOptions) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send(NO_AUTH);
    }

    if (options.roles && options.roles.length > 0 && !options.roles.includes(request.auth.role)) {
      return reply.status(403).send(NO_ROLE);
    }

    if (options.scopes && options.scopes.length > 0) {
      const granted = request.auth.scopes ?? [];
      const allowed =
        options.scopeMode === 'all'
          ? options.scopes.every((scope) => hasScope(granted, scope))
          : options.scopes.some((scope) => hasScope(granted, scope));

      if (!allowed) {
        return reply.status(403).send(NO_SCOPE);
      }
    }
  };
