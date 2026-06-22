import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('mail transporter lazy init', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.SMTP_PASS;
  });

  it('modül import edilirken SMTP_PASS olmadan çökmez', async () => {
    delete process.env.SMTP_PASS;

    await expect(import('@/infrastructure/resend/transporter')).resolves.toBeDefined();
  });

  it('getResend SMTP_PASS olmadan çağrılınca hata verir', async () => {
    delete process.env.SMTP_PASS;

    const { getResend } = await import('@/infrastructure/resend/transporter');

    expect(() => getResend()).toThrow('SMTP_PASS');
  });
});
