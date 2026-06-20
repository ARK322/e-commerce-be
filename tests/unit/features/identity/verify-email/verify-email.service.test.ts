import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signEmailVerificationToken } from '@/internal/auth/tokens/email-token';
import { AuthError } from '@/internal/auth/errors';

const mockFindOne = vi.fn();
const mockFindById = vi.fn();
const mockVerifyAuthOtp = vi.fn();
const mockInvalidateAuthOtp = vi.fn();
const mockDeleteUnverifiedUser = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  User: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
  },
}));

vi.mock('@/internal/auth/register/unverified-user', () => ({
  deleteUnverifiedUser: (...args: unknown[]) => mockDeleteUnverifiedUser(...args),
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

vi.mock('@/internal/auth/responses/user.response', () => ({
  buildAuthUserFields: vi.fn().mockImplementation(async (user: { role: string; isEmailVerified: boolean }) => ({
    role: user.role,
    isActive: false,
    companyId: null,
    isOwner: null,
    approvalStatus: null,
  })),
}));

import { OtpError } from '@/internal/auth/otp/otp';
import { verifyEmail } from '@/features/identity/verify-email/verify-email.service';

const userId = '550e8400-e29b-41d4-a716-446655440000';

const unverifiedUser = {
  _id: userId,
  role: 'buyer',
  isEmailVerified: false,
  verificationExpiresAt: new Date(Date.now() + 60_000),
};

describe('verifyEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-for-auth-tests';
    mockInvalidateAuthOtp.mockResolvedValue(undefined);
    mockDeleteUnverifiedUser.mockResolvedValue(undefined);
  });

  describe('token ile', () => {
    it('geçerli token ile e-postayı doğrular ve oturum tokeni döner', async () => {
      const save = vi.fn();
      const token = signEmailVerificationToken(userId);

      mockFindById.mockResolvedValue({
        ...unverifiedUser,
        save,
      });

      const result = await verifyEmail({ token });

      expect(result.isEmailVerified).toBe(true);
      expect(result.token).toEqual(expect.any(String));
      expect(save).toHaveBeenCalled();
      expect(mockInvalidateAuthOtp).toHaveBeenCalledWith(userId, 'email_verify');
      expect(mockVerifyAuthOtp).not.toHaveBeenCalled();
    });

    it('zaten doğrulanmış kullanıcıda 409 döner', async () => {
      const token = signEmailVerificationToken(userId);
      mockFindById.mockResolvedValue({
        ...unverifiedUser,
        isEmailVerified: true,
        save: vi.fn(),
      });

      await expect(verifyEmail({ token })).rejects.toMatchObject({
        statusCode: 409,
        message: 'E-posta zaten doğrulanmış',
      });
    });

    it('doğrulama süresi dolmuşsa kaydı siler ve 410 döner', async () => {
      const token = signEmailVerificationToken(userId);
      mockFindById.mockResolvedValue({
        ...unverifiedUser,
        verificationExpiresAt: new Date(Date.now() - 1_000),
        save: vi.fn(),
      });

      await expect(verifyEmail({ token })).rejects.toMatchObject({
        statusCode: 410,
        message: 'Doğrulama süresi doldu, lütfen tekrar kayıt ol',
      });

      expect(mockDeleteUnverifiedUser).toHaveBeenCalledWith(userId);
    });

    it('geçersiz token ile 400 döner', async () => {
      await expect(verifyEmail({ token: 'invalid-token' })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Geçersiz doğrulama tokeni',
      });
    });
  });

  describe('kod ile', () => {
    it('geçerli kod ile e-postayı doğrular ve oturum tokeni döner', async () => {
      const save = vi.fn();
      mockFindOne.mockResolvedValue(unverifiedUser);
      mockVerifyAuthOtp.mockResolvedValue(undefined);
      mockFindById.mockResolvedValue({
        ...unverifiedUser,
        save,
      });

      const result = await verifyEmail({ email: 'user@example.com', code: '482913' });

      expect(result.token).toEqual(expect.any(String));
      expect(mockFindOne).toHaveBeenCalledWith({ email: 'user@example.com' });
      expect(mockVerifyAuthOtp).toHaveBeenCalledWith(userId, 'email_verify', '482913');
      expect(save).toHaveBeenCalled();
    });

    it('kullanıcı yoksa generic hata döner', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        verifyEmail({ email: 'missing@example.com', code: '482913' })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Geçersiz doğrulama kodu veya e-posta',
      });
    });

    it('OTP hatasını AuthError olarak iletir', async () => {
      mockFindOne.mockResolvedValue(unverifiedUser);
      mockVerifyAuthOtp.mockRejectedValue(new OtpError(400, 'Doğrulama kodu hatalı'));

      await expect(
        verifyEmail({ email: 'user@example.com', code: '000000' })
      ).rejects.toBeInstanceOf(AuthError);
    });
  });
});
