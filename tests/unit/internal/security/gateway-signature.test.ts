import { describe, expect, it } from 'vitest';
import {
  GATEWAY_HEADERS,
  signGatewayHeaders,
  verifyGatewayHeaders,
} from '@/shared/security/gateway-signature';

const SECRET = 'super-secret-gateway-key';
const identity = { userId: 'user-1', role: 'seller', scopes: ['products:read', 'products:write'] };

const toHeaderBag = (signed: ReturnType<typeof signGatewayHeaders>) => ({
  [GATEWAY_HEADERS.userId]: signed.userId,
  [GATEWAY_HEADERS.role]: signed.role,
  [GATEWAY_HEADERS.scopes]: signed.scopes,
  [GATEWAY_HEADERS.timestamp]: signed.timestamp,
  [GATEWAY_HEADERS.signature]: signed.signature,
});

describe('signGatewayHeaders / verifyGatewayHeaders', () => {
  it('imzalı header seti üretir ve doğrular', () => {
    const signed = signGatewayHeaders(identity, SECRET);
    const result = verifyGatewayHeaders(toHeaderBag(signed), SECRET);

    expect(result).toEqual({
      valid: true,
      userId: 'user-1',
      role: 'seller',
      scopes: ['products:read', 'products:write'],
    });
  });

  it('rol header tahrif edilirse imza tutmaz (privilege escalation engeli)', () => {
    const signed = signGatewayHeaders(identity, SECRET);
    const tampered = { ...toHeaderBag(signed), [GATEWAY_HEADERS.role]: 'admin' };

    expect(verifyGatewayHeaders(tampered, SECRET)).toEqual({ valid: false });
  });

  it('yanlış secret ile doğrulanmaz', () => {
    const signed = signGatewayHeaders(identity, SECRET);
    expect(verifyGatewayHeaders(toHeaderBag(signed), 'other-secret')).toEqual({ valid: false });
  });

  it('imza header eksikse reddeder (spoof korumasi)', () => {
    expect(
      verifyGatewayHeaders(
        {
          [GATEWAY_HEADERS.userId]: 'attacker',
          [GATEWAY_HEADERS.role]: 'admin',
          [GATEWAY_HEADERS.scopes]: '*',
        },
        SECRET
      )
    ).toEqual({ valid: false });
  });

  it('bayat timestamp (replay) reddedilir', () => {
    const signed = signGatewayHeaders(identity, SECRET, Date.now() - 120_000);
    expect(verifyGatewayHeaders(toHeaderBag(signed), SECRET)).toEqual({ valid: false });
  });

  it('boş scope seti güvenli şekilde döner', () => {
    const signed = signGatewayHeaders({ userId: 'u', role: 'buyer', scopes: [] }, SECRET);
    const result = verifyGatewayHeaders(toHeaderBag(signed), SECRET);

    expect(result).toEqual({ valid: true, userId: 'u', role: 'buyer', scopes: [] });
  });
});
