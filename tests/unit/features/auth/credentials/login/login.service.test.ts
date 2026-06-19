import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindOne = vi.fn();
const mockComparePassword = vi.fn();
const mockSignAuthToken = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  User: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
  },
}));

vi.mock('@/internal/security', () => ({
  comparePassword: (...args: unknown[]) => mockComparePassword(...args),
}));

vi.mock('@/internal/auth/tokens/access-token', () => ({
  signAuthToken: (...args: unknown[]) => mockSignAuthToken(...args),
}));

import { login } from '@/features/auth/credentials/login/login.service';

const userId = '550e8400-e29b-41d4-a716-446655440000';

describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignAuthToken.mockReturnValue('access-token');
  });

  it('doğrulanmış buyer giriş yapabilir', async () => {
    mockFindOne.mockResolvedValue({
      _id: userId,
      role: 'buyer',
      password: 'hashed',
      isEmailVerified: true,
    });
    mockComparePassword.mockResolvedValue(true);

    const result = await login({
      email: 'buyer@example.com',
      password: 'Pass1234',
      rememberMe: false,
    });

    expect(result.token).toBe('access-token');
    expect(mockSignAuthToken).toHaveBeenCalledWith(userId, 'buyer', false);
  });

  it('e-postası doğrulanmamış buyer 403 alır', async () => {
    mockFindOne.mockResolvedValue({
      _id: userId,
      role: 'buyer',
      password: 'hashed',
      isEmailVerified: false,
    });
    mockComparePassword.mockResolvedValue(true);

    await expect(
      login({ email: 'buyer@example.com', password: 'Pass1234', rememberMe: false })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'E-posta adresini doğrulamadan giriş yapamazsın',
    });
  });

  it('admin e-posta doğrulaması olmadan giriş yapabilir', async () => {
    mockFindOne.mockResolvedValue({
      _id: userId,
      role: 'admin',
      password: 'hashed',
      isEmailVerified: false,
    });
    mockComparePassword.mockResolvedValue(true);

    const result = await login({
      email: 'admin@example.com',
      password: 'Pass1234',
      rememberMe: true,
    });

    expect(result.token).toBe('access-token');
    expect(mockSignAuthToken).toHaveBeenCalledWith(userId, 'admin', true);
  });

  it('hatalı şifrede 401 döner', async () => {
    mockFindOne.mockResolvedValue({
      _id: userId,
      role: 'buyer',
      password: 'hashed',
      isEmailVerified: true,
    });
    mockComparePassword.mockResolvedValue(false);

    await expect(
      login({ email: 'buyer@example.com', password: 'WrongPass', rememberMe: false })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'E-posta veya şifre hatalı',
    });
  });

  it('kayıtlı olmayan e-postada 401 döner', async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(
      login({ email: 'ghost@example.com', password: 'Pass1234', rememberMe: false })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'E-posta veya şifre hatalı',
    });
  });
});
