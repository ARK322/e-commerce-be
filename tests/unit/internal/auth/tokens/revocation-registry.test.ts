import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const getRedisMock = vi.fn();

vi.mock('@/integrations/redis/redis', () => ({
  getRedis: () => getRedisMock(),
}));

import {
  isAccessRevoked,
  recordTokenRevocation,
  recordUserRevocationCutoff,
} from '@/domains/identity/application/tokens/revocation-registry';

const makeRedis = (overrides: Partial<{ exists: unknown; get: unknown }> = {}) => ({
  set: vi.fn().mockResolvedValue('OK'),
  exists: vi.fn().mockResolvedValue(overrides.exists ?? 0),
  get: vi.fn().mockResolvedValue(overrides.get ?? null),
});

const futureToken = () => jwt.sign({ purpose: 'access' }, 'secret', { expiresIn: 3600 });

describe('revocation-registry', () => {
  const original = process.env.REDIS_URL;

  beforeEach(() => {
    getRedisMock.mockReset();
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = original;
    }
  });

  describe('REDIS_URL tanımsızken (no-op / fail-open)', () => {
    beforeEach(() => {
      delete process.env.REDIS_URL;
    });

    it('isAccessRevoked false döner ve Redis\'e dokunmaz', async () => {
      const result = await isAccessRevoked({ token: futureToken(), userId: 'u' });
      expect(result).toBe(false);
      expect(getRedisMock).not.toHaveBeenCalled();
    });

    it('recordTokenRevocation no-op olur', async () => {
      await recordTokenRevocation(futureToken());
      expect(getRedisMock).not.toHaveBeenCalled();
    });
  });

  describe('REDIS_URL tanımlıyken', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379';
    });

    it('recordTokenRevocation token\'ı TTL ile blacklist\'e yazar', async () => {
      const redis = makeRedis();
      getRedisMock.mockReturnValue(redis);

      await recordTokenRevocation(futureToken());

      expect(redis.set).toHaveBeenCalledTimes(1);
      const [key, value, mode, ttl] = redis.set.mock.calls[0];
      expect(String(key)).toMatch(/^revoked:token:/);
      expect(value).toBe('1');
      expect(mode).toBe('PX');
      expect(ttl).toBeGreaterThan(0);
    });

    it('recordUserRevocationCutoff cutoff timestamp yazar', async () => {
      const redis = makeRedis();
      getRedisMock.mockReturnValue(redis);

      await recordUserRevocationCutoff('user-1', 1_700_000_000_000);

      const [key, value, mode] = redis.set.mock.calls[0];
      expect(key).toBe('revoked:user:user-1');
      expect(value).toBe('1700000000000');
      expect(mode).toBe('PX');
    });

    it('blacklist\'teki token için true döner', async () => {
      getRedisMock.mockReturnValue(makeRedis({ exists: 1 }));
      expect(await isAccessRevoked({ token: futureToken(), userId: 'u' })).toBe(true);
    });

    it('iat cutoff\'tan önceyse true döner', async () => {
      getRedisMock.mockReturnValue(makeRedis({ get: String(2_000_000_000_000) }));
      const result = await isAccessRevoked({
        token: futureToken(),
        userId: 'u',
        issuedAtSeconds: 1_000_000_000, // 1_000_000_000_000 ms < cutoff
      });
      expect(result).toBe(true);
    });

    it('iat cutoff\'tan sonraysa false döner', async () => {
      getRedisMock.mockReturnValue(makeRedis({ get: String(1_000_000_000_000) }));
      const result = await isAccessRevoked({
        token: futureToken(),
        userId: 'u',
        issuedAtSeconds: 2_000_000_000, // 2_000_000_000_000 ms > cutoff
      });
      expect(result).toBe(false);
    });

    it('Redis hata verirse fail-open (false) döner', async () => {
      getRedisMock.mockImplementation(() => {
        throw new Error('redis down');
      });
      expect(await isAccessRevoked({ token: futureToken(), userId: 'u' })).toBe(false);
    });
  });
});
