import { FastifyRequest } from 'fastify';
import { env } from '@/config/env';
import { verifyGatewayHeaders } from '@/shared/security/gateway-signature';
import type { AuthTokenPayload, UserRole } from '@/domains/identity/application/tokens/access-token';

/**
 * Faz 3 / Aşama 3 — Downstream güven sınırı.
 *
 * Gateway'in imzaladığı X-User-* header'larını kimliğe çevirir. Yalnızca
 * GATEWAY_SIGNING_SECRET tanımlıysa VE imza + tazelik doğrulanırsa kimlik döner.
 * Aksi halde null döner → çağıran middleware klasik Bearer akışına düşer ve
 * imzasız (spoof) header'lar asla güvenilmez.
 */
export const resolveTrustedGatewayIdentity = (request: FastifyRequest): AuthTokenPayload | null => {
  const secret = env.gatewaySigningSecret;

  if (!secret) {
    return null;
  }

  const result = verifyGatewayHeaders(request.headers, secret);

  if (!result.valid) {
    return null;
  }

  if (result.role !== 'buyer' && result.role !== 'seller' && result.role !== 'admin') {
    return null;
  }

  return {
    userId: result.userId,
    role: result.role as UserRole,
    scopes: result.scopes,
  };
};
