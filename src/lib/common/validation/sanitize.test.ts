import { describe, expect, it } from 'vitest';
import { sanitizeRequestBody } from './sanitize';

describe('sanitizeRequestBody', () => {
  it('$ ile başlayan anahtarları temizler', () => {
    const result = sanitizeRequestBody({
      email: 'test@example.com',
      $gt: { password: 'hack' },
    });

    expect(result).toEqual({ email: 'test@example.com' });
  });

  it('iç içe tehlikeli anahtarları temizler', () => {
    const result = sanitizeRequestBody({
      profile: {
        'role.$eq': 'admin',
        name: 'ACME',
      },
    });

    expect(result).toEqual({ profile: { name: 'ACME' } });
  });
});
