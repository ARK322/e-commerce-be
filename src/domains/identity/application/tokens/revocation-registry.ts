import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { getRedis } from '@/integrations/redis/redis';
import { createLogger } from '@/shared/logging';

/**
 * Faz 3 / Aşama 3 — Dağıtık Revocation Registry (Redis).
 *
 * Mongo kaynak gerçek (source of truth) olarak kalır; revocation olayları
 * (logout, şifre değişimi, oturum iptali, ban) ayrıca Redis'e yazılır
 * (dual-write). Gateway, RS256 doğrulamasından sonra bu hızlı/dağıtık katmanı
 * okuyarak banlı/iptalli token'ları edge'de eler — alt servisler stateless kalır.
 *
 * Tüm yazma/okuma işlemleri lazy + fail-safe'tir:
 *  - REDIS_URL tanımsızsa (monolith/test) → no-op / false.
 *  - Redis erişilemezse → yazıda warn+devam, okumada fail-open (erişime izin),
 *    böylece altyapı kesintisi tüm platformu kilitlemez (warn loglanır).
 */
const log = createLogger({ module: 'revocation-registry' });

const tokenKey = (hash: string): string => `revoked:token:${hash}`;
const userKey = (userId: string): string => `revoked:user:${userId}`;

/** Kullanıcı cutoff anahtarı TTL'i — en uzun token ömrü (rememberMe = 30 gün). */
const USER_CUTOFF_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const redisEnabled = (): boolean => Boolean(env.redisUrl);

/** Tek bir token'ı blacklist'e alır (logout). TTL = token'ın kalan ömrü. */
export const recordTokenRevocation = async (token: string): Promise<void> => {
  if (!redisEnabled()) {
    return;
  }

  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  const ttlMs = decoded?.exp ? decoded.exp * 1000 - Date.now() : 0;

  if (ttlMs <= 0) {
    return;
  }

  try {
    const redis = await getRedis();
    await redis.set(tokenKey(hashToken(token)), '1', 'PX', Math.ceil(ttlMs));
  } catch (err) {
    log.warn({ err }, 'Redis token revocation yazılamadı');
  }
};

/**
 * Kullanıcının tüm oturumları için bir geçersizlik cutoff'u (epoch ms) yazar.
 * Bu andan önce verilmiş (iat < cutoff) tüm token'lar geçersiz sayılır.
 */
export const recordUserRevocationCutoff = async (
  userId: string,
  atMs: number = Date.now()
): Promise<void> => {
  if (!redisEnabled()) {
    return;
  }

  try {
    const redis = await getRedis();
    await redis.set(userKey(userId), String(atMs), 'PX', USER_CUTOFF_TTL_MS);
  } catch (err) {
    log.warn({ err, userId }, 'Redis user revocation cutoff yazılamadı');
  }
};

export type RevocationCheck = {
  token: string;
  userId: string;
  issuedAtSeconds?: number;
};

/**
 * Token blacklist'te mi veya iat kullanıcı cutoff'undan önce mi?
 * Redis yok/erişilemezse fail-open (false) döner.
 */
export const isAccessRevoked = async ({
  token,
  userId,
  issuedAtSeconds,
}: RevocationCheck): Promise<boolean> => {
  if (!redisEnabled()) {
    return false;
  }

  try {
    const redis = await getRedis();
    const [tokenHit, cutoffRaw] = await Promise.all([
      redis.exists(tokenKey(hashToken(token))),
      redis.get(userKey(userId)),
    ]);

    if (tokenHit === 1) {
      return true;
    }

    if (cutoffRaw && issuedAtSeconds !== undefined) {
      const cutoff = Number(cutoffRaw);
      if (Number.isFinite(cutoff) && issuedAtSeconds * 1000 < cutoff) {
        return true;
      }
    }

    return false;
  } catch (err) {
    log.warn({ err, userId }, 'Redis revocation kontrolü başarısız (fail-open)');
    return false;
  }
};
