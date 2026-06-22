import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Faz 3 / Aşama 3 — Güven Sınırı (Trust Boundary).
 *
 * Gateway, doğruladığı kullanıcı kimliğini alt servislere X-User-* header'ları
 * ile paslar. Kötü niyetli biri gateway'i bypass edip doğrudan alt servise
 * X-User-Role: admin gönderebilir — bu yüzden alt servisler header'lara ASLA
 * imzasız güvenmez. Gateway, header'ları paylaşılan gizli anahtarla (HMAC)
 * imzalar; alt servis imzayı + tazeliği doğrulamadan kimliği kabul etmez.
 */
export const GATEWAY_HEADERS = {
  userId: 'x-user-id',
  role: 'x-user-role',
  scopes: 'x-user-scopes',
  timestamp: 'x-gateway-timestamp',
  signature: 'x-gateway-signature',
} as const;

export type GatewayIdentityHeaders = {
  userId: string;
  role: string;
  scopes: string;
  timestamp: string;
  signature: string;
};

/** İmza tazelik penceresi (replay saldırılarını sınırlamak için). */
const DEFAULT_MAX_SKEW_MS = 60_000;

const buildCanonicalMessage = (parts: {
  userId: string;
  role: string;
  scopes: string;
  timestamp: string;
}): string => `${parts.userId}\n${parts.role}\n${parts.scopes}\n${parts.timestamp}`;

const computeSignature = (secret: string, message: string): string =>
  createHmac('sha256', secret).update(message).digest('base64url');

/** Gateway tarafı: kullanıcı kimliği için imzalı header seti üretir. */
export const signGatewayHeaders = (
  identity: { userId: string; role: string; scopes: string[] },
  secret: string,
  now: number = Date.now()
): GatewayIdentityHeaders => {
  const timestamp = String(now);
  const scopes = identity.scopes.join(',');
  const signature = computeSignature(
    secret,
    buildCanonicalMessage({ userId: identity.userId, role: identity.role, scopes, timestamp })
  );

  return { userId: identity.userId, role: identity.role, scopes, timestamp, signature };
};

const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

export type GatewayVerifyResult =
  | { valid: true; userId: string; role: string; scopes: string[] }
  | { valid: false };

/**
 * Downstream tarafı: gelen header'ların gateway tarafından imzalandığını doğrular.
 * Geçersiz imza, eksik header veya bayat timestamp → { valid: false }.
 */
export const verifyGatewayHeaders = (
  headers: Partial<Record<string, string | string[]>>,
  secret: string,
  options: { maxSkewMs?: number; now?: number } = {}
): GatewayVerifyResult => {
  const get = (name: string): string | undefined => {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  const userId = get(GATEWAY_HEADERS.userId);
  const role = get(GATEWAY_HEADERS.role);
  const scopes = get(GATEWAY_HEADERS.scopes) ?? '';
  const timestamp = get(GATEWAY_HEADERS.timestamp);
  const signature = get(GATEWAY_HEADERS.signature);

  if (!userId || !role || !timestamp || !signature) {
    return { valid: false };
  }

  const ts = Number(timestamp);
  const now = options.now ?? Date.now();
  const maxSkew = options.maxSkewMs ?? DEFAULT_MAX_SKEW_MS;

  if (!Number.isFinite(ts) || Math.abs(now - ts) > maxSkew) {
    return { valid: false };
  }

  const expected = computeSignature(secret, buildCanonicalMessage({ userId, role, scopes, timestamp }));

  if (!safeEqual(expected, signature)) {
    return { valid: false };
  }

  return {
    valid: true,
    userId,
    role,
    scopes: scopes ? scopes.split(',').filter(Boolean) : [],
  };
};
