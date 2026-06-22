import { describe, expect, it } from 'vitest';
import {
  assertEmailCooldown,
  EmailCooldownError,
  EMAIL_COOLDOWN_MS,
  getEmailCooldownRemainingSeconds,
} from '@/domains/identity/application/mail/cooldown';

describe('getEmailCooldownRemainingSeconds', () => {
  it('daha önce mail gönderilmediyse 0 döner', () => {
    expect(getEmailCooldownRemainingSeconds(null)).toBe(0);
  });

  it('cooldown içindeyse kalan saniyeyi döner', () => {
    const lastSentAt = new Date(Date.now() - 10_000);
    const remaining = getEmailCooldownRemainingSeconds(lastSentAt);

    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(Math.ceil(EMAIL_COOLDOWN_MS / 1000));
  });

  it('cooldown bittiyse 0 döner', () => {
    const lastSentAt = new Date(Date.now() - EMAIL_COOLDOWN_MS - 1_000);
    expect(getEmailCooldownRemainingSeconds(lastSentAt)).toBe(0);
  });
});

describe('assertEmailCooldown', () => {
  it('cooldown içinde 429 fırlatır', () => {
    const lastSentAt = new Date();

    expect(() => assertEmailCooldown(lastSentAt)).toThrow(EmailCooldownError);
    expect(() => assertEmailCooldown(lastSentAt)).toThrow(/saniye sonra tekrar deneyin/);
  });

  it('cooldown dışında hata fırlatmaz', () => {
    const lastSentAt = new Date(Date.now() - EMAIL_COOLDOWN_MS - 1_000);
    expect(() => assertEmailCooldown(lastSentAt)).not.toThrow();
  });
});
