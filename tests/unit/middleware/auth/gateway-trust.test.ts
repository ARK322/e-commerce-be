import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { resolveTrustedGatewayIdentity } from '@/shared/middleware/auth/gateway-trust';
import { GATEWAY_HEADERS, signGatewayHeaders } from '@/shared/security/gateway-signature';

const SECRET = 'downstream-trust-secret';

const requestWithHeaders = (headers: Record<string, string>): FastifyRequest =>
  ({ headers }) as unknown as FastifyRequest;

const signedHeaders = (identity: { userId: string; role: string; scopes: string[] }) => {
  const signed = signGatewayHeaders(identity, SECRET);
  return {
    [GATEWAY_HEADERS.userId]: signed.userId,
    [GATEWAY_HEADERS.role]: signed.role,
    [GATEWAY_HEADERS.scopes]: signed.scopes,
    [GATEWAY_HEADERS.timestamp]: signed.timestamp,
    [GATEWAY_HEADERS.signature]: signed.signature,
  };
};

describe('resolveTrustedGatewayIdentity', () => {
  const original = process.env.GATEWAY_SIGNING_SECRET;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.GATEWAY_SIGNING_SECRET;
    } else {
      process.env.GATEWAY_SIGNING_SECRET = original;
    }
  });

  describe('secret tanımlı değilken', () => {
    beforeEach(() => {
      delete process.env.GATEWAY_SIGNING_SECRET;
    });

    it('imzalı header gelse bile güvenmez (null döner)', () => {
      const request = requestWithHeaders(
        signedHeaders({ userId: 'u', role: 'admin', scopes: ['*'] })
      );
      expect(resolveTrustedGatewayIdentity(request)).toBeNull();
    });
  });

  describe('secret tanımlıyken', () => {
    beforeEach(() => {
      process.env.GATEWAY_SIGNING_SECRET = SECRET;
    });

    it('geçerli imzalı header\'lardan kimliği çözer', () => {
      const request = requestWithHeaders(
        signedHeaders({ userId: 'user-1', role: 'seller', scopes: ['products:write'] })
      );

      expect(resolveTrustedGatewayIdentity(request)).toEqual({
        userId: 'user-1',
        role: 'seller',
        scopes: ['products:write'],
      });
    });

    it('imzasız (spoof) X-User-* header\'larına güvenmez', () => {
      const request = requestWithHeaders({
        [GATEWAY_HEADERS.userId]: 'attacker',
        [GATEWAY_HEADERS.role]: 'admin',
        [GATEWAY_HEADERS.scopes]: '*',
      });

      expect(resolveTrustedGatewayIdentity(request)).toBeNull();
    });

    it('tahrif edilmiş rol header\'ı reddedilir', () => {
      const headers = signedHeaders({ userId: 'u', role: 'buyer', scopes: ['cart:write'] });
      headers[GATEWAY_HEADERS.role] = 'admin';

      expect(resolveTrustedGatewayIdentity(requestWithHeaders(headers))).toBeNull();
    });
  });
});
