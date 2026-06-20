import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signPasswordResetToken } from '@/internal/auth/tokens/email-token';

const mockFindOne = vi.fn();
const mockFindById = vi.fn();
const mockFindByIdAndUpdate = vi.fn();
const mockVerifyAuthOtp = vi.fn();
const mockInvalidateAuthOtp = vi.fn();
const mockHashPassword = vi.fn();

vi.mock('@/repositories/auth/user.repository', () => ({
  findUserByEmail: (...args: unknown[]) => mockFindOne(...args),
  findUserById: (...args: unknown[]) => mockFindById(...args),
  updateUserById: (...args: unknown[]) => mockFindByIdAndUpdate(...args),
}));

vi.mock('@/internal/auth/otp/otp', async () => {
  class OtpError extends Error {
    constructor(
      public statusCode: number,
      message: string
    ) {
      super(message);
    }
  }

  return {
    verifyAuthOtp: (...args: unknown[]) => mockVerifyAuthOtp(...args),
    invalidateAuthOtp: (...args: unknown[]) => mockInvalidateAuthOtp(...args),
    OtpError,
  };
});

vi.mock('@/internal/common/security', () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
  comparePassword: vi.fn(),
}));

import { OtpError } from '@/internal/auth/otp/otp';
import { resetPassword } from '@/features/identity/reset-password/reset-password.service';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const newPassword = 'NewPass123';

describe('resetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-for-auth-tests';
    mockHashPassword.mockResolvedValue('hashed-new-password');
    mockFindById.mockResolvedValue({ _id: userId });
    mockFindByIdAndUpdate.mockResolvedValue({});
    mockInvalidateAuthOtp.mockResolvedValue(undefined);
  });

  describe('token ile', () => {
    it('geçerli token ile şifreyi günceller', async () => {
      const token = signPasswordResetToken(userId);

      await resetPassword({ token, newPassword });

      expect(mockHashPassword).toHaveBeenCalledWith(newPassword);
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          $set: expect.objectContaining({
            password: 'hashed-new-password',
            passwordChangedAt: expect.any(Date),
          }),
        })
      );
      expect(mockInvalidateAuthOtp).toHaveBeenCalledWith(userId, 'password_reset');
      expect(mockVerifyAuthOtp).not.toHaveBeenCalled();
    });

    it('geçersiz token ile 400 döner', async () => {
      await expect(
        resetPassword({ token: 'bad-token', newPassword })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Geçersiz sıfırlama tokeni',
      });
    });
  });

  describe('kod ile', () => {
    it('geçerli kod ile şifreyi günceller', async () => {
      mockFindOne.mockResolvedValue({ _id: userId });
      mockVerifyAuthOtp.mockResolvedValue(undefined);

      await resetPassword({
        email: 'user@example.com',
        code: '482913',
        newPassword,
      });

      expect(mockFindOne).toHaveBeenCalledWith('user@example.com');
      expect(mockVerifyAuthOtp).toHaveBeenCalledWith(
        userId,
        'password_reset',
        '482913'
      );
      expect(mockFindByIdAndUpdate).toHaveBeenCalled();
    });

    it('kullanıcı yoksa generic hata döner', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        resetPassword({
          email: 'missing@example.com',
          code: '482913',
          newPassword,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Geçersiz doğrulama kodu veya e-posta',
      });
    });

    it('5 hatalı OTP denemesinde 429 döner', async () => {
      mockFindOne.mockResolvedValue({ _id: userId });
      mockVerifyAuthOtp.mockRejectedValue(
        new OtpError(429, 'Çok fazla hatalı deneme. Yeni kod isteyin')
      );

      await expect(
        resetPassword({
          email: 'user@example.com',
          code: '000000',
          newPassword,
        })
      ).rejects.toMatchObject({
        statusCode: 429,
        message: 'Çok fazla hatalı deneme. Yeni kod isteyin',
      });
    });
  });
});
