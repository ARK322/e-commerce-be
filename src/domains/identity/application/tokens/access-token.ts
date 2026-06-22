import jwt from 'jsonwebtoken';
import {
  getAccessTokenSigner,
  getAccessTokenVerificationKey,
  type JwtAlgorithm,
} from '@/domains/identity/application/tokens/jwt-keys';
import {
  getDefaultScopesForRole,
  normalizeScopes,
} from '@/domains/identity/application/access/scopes';

const TOKEN_EXPIRES = {
  default: '1d',
  rememberMe: '30d',
} as const;

export type UserRole = 'buyer' | 'seller' | 'admin';

export type AuthTokenPayload = {
  userId: string;
  role: UserRole;
  /**
   * Stateless RBAC scope seti — verifyAuthToken her zaman doldurur (legacy
   * token'larda role'den türetir). Manuel kurulan payload'larda (testler)
   * opsiyonel kalır; guard'lar `scopes ?? []` ile güvenli okur.
   */
  scopes?: string[];
};

const resolveTokenAlgorithm = (token: string): JwtAlgorithm => {
  const decoded = jwt.decode(token, { complete: true });
  return decoded?.header.alg === 'RS256' ? 'RS256' : 'HS256';
};

export const signAuthToken = (
  userId: string,
  role: UserRole,
  rememberMe = false,
  scopes: string[] = getDefaultScopesForRole(role)
): string => {
  const expiresIn = rememberMe ? TOKEN_EXPIRES.rememberMe : TOKEN_EXPIRES.default;
  const signer = getAccessTokenSigner();

  return jwt.sign({ purpose: 'access', role, scopes }, signer.key, {
    subject: userId,
    expiresIn,
    algorithm: signer.algorithm,
  });
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  const algorithm = resolveTokenAlgorithm(token);
  const key = getAccessTokenVerificationKey(algorithm);

  const payload = jwt.verify(token, key, { algorithms: [algorithm] }) as jwt.JwtPayload;

  if (payload.purpose !== 'access' || !payload.sub || !payload.role) {
    throw new jwt.JsonWebTokenError('Geçersiz token');
  }

  if (
    payload.role !== 'buyer' &&
    payload.role !== 'seller' &&
    payload.role !== 'admin'
  ) {
    throw new jwt.JsonWebTokenError('Geçersiz token');
  }

  const role = payload.role as UserRole;

  return {
    userId: payload.sub,
    role,
    // Legacy token (scopes yok) → role'den türet; yeni token → gömülü scope'lar.
    scopes: normalizeScopes(payload.scopes, role),
  };
};
