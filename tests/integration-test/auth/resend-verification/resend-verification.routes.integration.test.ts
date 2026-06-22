import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '@/app/app';

const mockResendVerificationEmail = vi.fn();

vi.mock('@/features/auth/resend-verification/resend-verification.service', () => ({
  resendVerificationEmail: (...args: unknown[]) => mockResendVerificationEmail(...args),
}));

describe('resend-verification routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockResendVerificationEmail.mockResolvedValue(undefined);
  });

  it('POST /auth/resend-verification geçersiz e-posta ile 400 döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/resend-verification',
      payload: { email: 'bad' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('POST /auth/resend-verification başarılı yanıt döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/resend-verification',
      payload: { email: 'user@test.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      message: 'E-posta kayıtlı ve doğrulanmamışsa doğrulama maili gönderildi',
    });
    expect(mockResendVerificationEmail).toHaveBeenCalledWith('user@test.com');
  });
});
