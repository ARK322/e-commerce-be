import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '@/app/app';

const mockRegister = vi.fn();

vi.mock('@/features/auth/register/register.service', () => ({
  register: (...args: unknown[]) => mockRegister(...args),
}));

describe('register routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /auth/register geçersiz body ile 400 döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'not-an-email' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('POST /auth/register başarılı kayıt oluşturur', async () => {
    mockRegister.mockResolvedValue({
      message: 'Kayıt başarılı. E-posta adresini doğrula.',
      role: 'buyer',
      isActive: false,
      companyId: null,
      isOwner: null,
      approvalStatus: null,
      isEmailVerified: false,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'buyer@test.com',
        password: 'Test1234!',
        role: 'buyer',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      message: 'Kayıt başarılı. E-posta adresini doğrula.',
      role: 'buyer',
      isEmailVerified: false,
    });
  });
});
