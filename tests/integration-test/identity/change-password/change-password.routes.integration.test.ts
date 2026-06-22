import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signAuthToken } from '@/domains/identity/application/tokens/access-token';
import { buildApp } from '@/app/app';

const mockChangePassword = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/api/auth/change-password/change-password.service', () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
}));

vi.mock('@/integrations/mongo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/integrations/mongo')>();
  return {
    ...actual,
    User: {
      ...actual.User,
      findById: (...args: unknown[]) => mockUserFindById(...args),
    },
    RevokedToken: {
      ...actual.RevokedToken,
      exists: (...args: unknown[]) => mockRevokedTokenExists(...args),
    },
  };
});

const userId = '550e8400-e29b-41d4-a716-446655440000';

const mockVerifiedUser = () => {
  mockUserFindById.mockImplementation((id: string) => {
    if (id === userId) {
      return {
        select: vi.fn().mockResolvedValue({
          _id: userId,
          role: 'buyer',
          isEmailVerified: true,
          passwordChangedAt: null,
          sessionsRevokedAt: null,
        }),
      };
    }

    return {
      select: vi.fn().mockResolvedValue({ isEmailVerified: true, role: 'buyer' }),
    };
  });
};

describe('change-password routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-jwt-secret-with-32-chars-minimum';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
    mockChangePassword.mockResolvedValue(undefined);
  });

  it('POST /auth/change-password token olmadan 401 döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      payload: { currentPassword: 'OldPass1', newPassword: 'NewPass1' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /auth/change-password geçersiz body ile 400 döner', async () => {
    const token = signAuthToken(userId, 'buyer');
    mockVerifiedUser();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: '', newPassword: 'short' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('POST /auth/change-password geçerli istek ile şifreyi değiştirir', async () => {
    const token = signAuthToken(userId, 'buyer');
    mockVerifiedUser();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'OldPass1', newPassword: 'NewPass1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Şifre başarıyla değiştirildi' });
    expect(mockChangePassword).toHaveBeenCalledWith(
      expect.objectContaining({ userId, role: 'buyer' }),
      { currentPassword: 'OldPass1', newPassword: 'NewPass1' }
    );
  });
});
