import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUserById = vi.fn();
const mockBuildAuthUserFields = vi.fn();

vi.mock('@/repositories/auth/user.repository', () => ({
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
}));

vi.mock('@/domain/auth/responses/user.response', () => ({
  buildAuthUserFields: (...args: unknown[]) => mockBuildAuthUserFields(...args),
}));

import { getMe } from '@/features/auth/me/me.service';

const userId = '550e8400-e29b-41d4-a716-446655440000';

describe('getMe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('kullanıcı bulunamazsa 404 döner', async () => {
    mockFindUserById.mockResolvedValue(null);

    await expect(getMe({ userId, role: 'buyer' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Kullanıcı bulunamadı',
    });
  });

  it('buyer için email ve durum alanlarını döner', async () => {
    mockFindUserById.mockResolvedValue({
      email: 'buyer@example.com',
      role: 'buyer',
      isActive: true,
      isEmailVerified: true,
    });
    mockBuildAuthUserFields.mockResolvedValue({
      userId,
      role: 'buyer',
      isEmailVerified: true,
      isActive: true,
    });

    const result = await getMe({ userId, role: 'buyer' });

    expect(result).toEqual({
      email: 'buyer@example.com',
      userId,
      role: 'buyer',
      isEmailVerified: true,
      isActive: true,
    });
  });
});
