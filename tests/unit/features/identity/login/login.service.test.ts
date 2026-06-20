import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindOne = vi.fn();
const mockFindByIdAndUpdate = vi.fn();
const mockComparePassword = vi.fn();
const mockSignAuthToken = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  User: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    findByIdAndUpdate: (...args: unknown[]) => mockFindByIdAndUpdate(...args),
  },
}));

vi.mock('@/internal/common/security', () => ({
  comparePassword: (...args: unknown[]) => mockComparePassword(...args),
}));

vi.mock('@/internal/auth/tokens/access-token', () => ({
  signAuthToken: (...args: unknown[]) => mockSignAuthToken(...args),
}));

vi.mock('@/internal/auth/responses/user.response', () => ({
  buildAuthUserFields: vi.fn().mockResolvedValue({
    role: 'buyer',
    isActive: true,
    companyId: null,
    isOwner: null,
    approvalStatus: null,
  }),
}));

import { login } from '@/features/identity/login/login.service';

const userId = '550e8400-e29b-41d4-a716-446655440000';

describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignAuthToken.mockReturnValue('access-token');
    mockFindByIdAndUpdate.mockResolvedValue({});
  });

  it('doğrulanmış buyer giriş yapabilir', async () => {
    mockFindOne.mockResolvedValue({
      _id: userId,
      role: 'buyer',
      password: 'hashed',
      isEmailVerified: true,
      failedLoginAttempts: 0,
      loginBlockedUntil: null,
    });
    mockComparePassword.mockResolvedValue(true);

    const result = await login({
      email: 'buyer@example.com',
      password: 'Pass1234',
      rememberMe: false,
    });

    expect(result.token).toBe('access-token');
    expect(mockSignAuthToken).toHaveBeenCalledWith(userId, 'buyer', false);
    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(userId, {
      $set: { failedLoginAttempts: 0, loginBlockedUntil: null },
    });
  });

  it('e-postası doğrulanmamış buyer 403 alır', async () => {
    mockFindOne.mockResolvedValue({
      _id: userId,
      role: 'buyer',
      password: 'hashed',
      isEmailVerified: false,
      failedLoginAttempts: 0,
      loginBlockedUntil: null,
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
      failedLoginAttempts: 0,
      loginBlockedUntil: null,
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

  it('hatalı şifrede 401 döner ve deneme sayısını artırır', async () => {
    mockFindOne.mockResolvedValue({
      _id: userId,
      role: 'buyer',
      password: 'hashed',
      isEmailVerified: true,
      failedLoginAttempts: 2,
      loginBlockedUntil: null,
    });
    mockComparePassword.mockResolvedValue(false);

    await expect(
      login({ email: 'buyer@example.com', password: 'WrongPass', rememberMe: false })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'E-posta veya şifre hatalı',
    });

    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(userId, {
      $set: { failedLoginAttempts: 3 },
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

  it('hesap kilitliyken 429 döner', async () => {
    mockFindOne.mockResolvedValue({
      _id: userId,
      role: 'buyer',
      password: 'hashed',
      isEmailVerified: true,
      failedLoginAttempts: 5,
      loginBlockedUntil: new Date(Date.now() + 60_000),
    });

    await expect(
      login({ email: 'buyer@example.com', password: 'Pass1234', rememberMe: false })
    ).rejects.toMatchObject({
      statusCode: 429,
    });
  });
});
