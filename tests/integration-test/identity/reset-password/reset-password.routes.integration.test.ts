import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '@/app/app';

const mockResetPassword = vi.fn();

vi.mock('@/api/auth/reset-password/reset-password.service', () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
}));

describe('reset-password routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockResetPassword.mockResolvedValue(undefined);
  });

  it('POST /auth/reset-password geçersiz body ile 400 döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'x', newPassword: 'short' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('POST /auth/reset-password token ile şifreyi sıfırlar', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'reset-token-123', newPassword: 'NewPass1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Şifre başarıyla sıfırlandı' });
    expect(mockResetPassword).toHaveBeenCalledWith({
      token: 'reset-token-123',
      newPassword: 'NewPass1',
    });
  });
});
