import { describe, expect, it } from 'vitest';
import {
  isTokenIssuedBefore,
  PASSWORD_CHANGED_MESSAGE,
  SESSIONS_REVOKED_MESSAGE,
} from '@/domains/identity/application/tokens/invalidate-all';

describe('isTokenIssuedBefore', () => {
  it('invalidationPoint yoksa oturumu geçerli sayar', () => {
    expect(isTokenIssuedBefore(1_700_000_000, null)).toBe(false);
  });

  it('invalidation noktasından önce üretilen tokeni geçersiz sayar', () => {
    const invalidationPoint = new Date('2024-01-02T00:00:00.000Z');
    const tokenIssuedAtSeconds = Math.floor(
      new Date('2024-01-01T00:00:00.000Z').getTime() / 1000
    );

    expect(isTokenIssuedBefore(tokenIssuedAtSeconds, invalidationPoint)).toBe(true);
  });

  it('invalidation noktasından sonra üretilen tokeni geçerli sayar', () => {
    const invalidationPoint = new Date('2024-01-01T00:00:00.000Z');
    const tokenIssuedAtSeconds = Math.floor(
      new Date('2024-01-02T00:00:00.000Z').getTime() / 1000
    );

    expect(isTokenIssuedBefore(tokenIssuedAtSeconds, invalidationPoint)).toBe(false);
  });
});

describe('auth messages', () => {
  it('PASSWORD_CHANGED_MESSAGE frontend için sabit mesaj içerir', () => {
    expect(PASSWORD_CHANGED_MESSAGE).toContain('tekrar giriş yapın');
  });

  it('SESSIONS_REVOKED_MESSAGE frontend için sabit mesaj içerir', () => {
    expect(SESSIONS_REVOKED_MESSAGE).toContain('tekrar giriş yapın');
  });
});
