import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '@/app/app';

const mockForgotPassword = vi.fn();

vi.mock('@/features/auth/forgot-password/forgot-password.service', () => ({
  forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
}));

describe('forgot-password routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockForgotPassword.mockResolvedValue(undefined);
  });

  it('POST /auth/forgot-password geçersiz e-posta ile 400 döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'invalid' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('POST /auth/forgot-password başarılı yanıt döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'user@test.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      message: 'E-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi',
    });
    expect(mockForgotPassword).toHaveBeenCalledWith('user@test.com');
  });
});
