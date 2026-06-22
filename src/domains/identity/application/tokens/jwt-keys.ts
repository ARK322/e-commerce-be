import fs from 'node:fs';
import { env } from '@/config/env';

/**
 * Faz 3 — Asimetrik kimlik doğrulama temeli (Crypto Foundation).
 *
 * Identity Server: private key ile imzalar (RS256).
 * Diğer servisler / gateway: sadece public key ile matematiksel doğrulama yapar,
 * merkezi auth DB'ye sormaz (loose coupling).
 *
 * Geriye uyumluluk: RS256 anahtarı tanımlı DEĞİLSE sistem HS256 + JWT_SECRET ile
 * çalışmaya devam eder. Doğrulama tarafında her iki algoritma da desteklenir.
 */
export type JwtAlgorithm = 'HS256' | 'RS256';

const normalizePem = (value: string): string =>
  value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;

const readKeyMaterial = (
  inlineEnvVar: string | undefined,
  pathEnvVar: string | undefined
): string | undefined => {
  if (inlineEnvVar?.trim()) {
    return normalizePem(inlineEnvVar.trim());
  }

  if (pathEnvVar?.trim()) {
    return fs.readFileSync(pathEnvVar.trim(), 'utf8');
  }

  return undefined;
};

/** Identity Server'a ait imzalama anahtarı (sadece bu servis bilmeli). */
export const getJwtPrivateKey = (): string | undefined =>
  readKeyMaterial(process.env.JWT_PRIVATE_KEY, process.env.JWT_PRIVATE_KEY_PATH);

/** Tüm servislerin doğrulama için kullandığı public key. */
export const getJwtPublicKey = (): string | undefined =>
  readKeyMaterial(process.env.JWT_PUBLIC_KEY, process.env.JWT_PUBLIC_KEY_PATH);

/** RS256 imzalama aktif mi? (private key tanımlıysa). */
export const isRs256Enabled = (): boolean => Boolean(getJwtPrivateKey());

export type AccessTokenSigner = {
  algorithm: JwtAlgorithm;
  key: string;
};

/**
 * İmzalama konfigürasyonu: RS256 anahtarı varsa onu, yoksa HS256 + JWT_SECRET.
 * (HS256 fallback'i mevcut davranışı korur; JWT_SECRET yoksa env getter hata fırlatır.)
 */
export const getAccessTokenSigner = (): AccessTokenSigner => {
  const privateKey = getJwtPrivateKey();

  if (privateKey) {
    return { algorithm: 'RS256', key: privateKey };
  }

  return { algorithm: 'HS256', key: env.jwtSecret };
};

/**
 * Doğrulama anahtarı, token'ın beyan ettiği algoritmaya göre seçilir.
 *
 * GÜVENLİK: HS256 her zaman simetrik secret ile, RS256 her zaman public key ile
 * doğrulanır. Böylece klasik "RS256→HS256 algoritma karıştırma" saldırısı
 * (public key'i HMAC secret gibi kullanma) imkânsız hale gelir.
 */
export const getAccessTokenVerificationKey = (algorithm: JwtAlgorithm): string => {
  if (algorithm === 'RS256') {
    const publicKey = getJwtPublicKey();

    if (!publicKey) {
      throw new Error('JWT_PUBLIC_KEY tanımlanmamış (RS256 doğrulama için gerekli)');
    }

    return publicKey;
  }

  return env.jwtSecret;
};
