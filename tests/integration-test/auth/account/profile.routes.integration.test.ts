import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signAuthToken } from '@/internal/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/auth/account/profile/profile.service', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
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

const buyerId = '550e8400-e29b-41d4-a716-446655440000';

const mockVerifiedBuyer = () => {
  mockUserFindById.mockImplementation((id: string) => {
    if (id === buyerId) {
      return {
        select: vi.fn().mockResolvedValue({
          _id: buyerId,
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

describe('profile routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
  });

  it('GET /auth/profile token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/profile' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/profile buyer profili döner', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockVerifiedBuyer();
    mockGetProfile.mockResolvedValue({
      email: 'buyer@test.com',
      role: 'buyer',
      profile: { firstName: 'Ali', lastName: 'Veli' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/profile',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      email: 'buyer@test.com',
      profile: { firstName: 'Ali', lastName: 'Veli' },
    });
  });

  it('PATCH /auth/profile geçersiz body ile 400 döner', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockVerifiedBuyer();

    const response = await app.inject({
      method: 'PATCH',
      url: '/auth/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('PATCH /auth/profile geçerli body ile profili günceller', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockVerifiedBuyer();
    mockUpdateProfile.mockResolvedValue(undefined);
    mockGetProfile.mockResolvedValue({
      email: 'buyer@test.com',
      role: 'buyer',
      profile: { firstName: 'Mehmet', lastName: 'Veli' },
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/auth/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: { firstName: 'Mehmet' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Profil güncellendi',
      profile: { firstName: 'Mehmet', lastName: 'Veli' },
    });
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ userId: buyerId, role: 'buyer' }),
      { firstName: 'Mehmet' }
    );
  });
});
