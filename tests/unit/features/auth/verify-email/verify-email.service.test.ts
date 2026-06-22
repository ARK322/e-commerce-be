import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signEmailVerificationToken } from '@/domain/auth/tokens/email-token';
import { AuthError } from '@/domain/auth/errors';

const mockFindOne = vi.fn();
const mockFindById = vi.fn();
const mockUpdateUserById = vi.fn();
const mockVerifyAuthOtp = vi.fn();
const mockInvalidateAuthOtp = vi.fn();
const mockDeleteUnverifiedUser = vi.fn();

vi.mock('@/repositories/auth/user.repository', () => ({
  findUserByEmail: (...args: unknown[]) => mockFindOne(...args),
  findUserById: (...args: unknown[]) => mockFindById(...args),
  updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
  saveUserDocument: (user: { save: () => Promise<unknown> }) => user.save(),
}));

vi.mock('@/domain/auth/register/unverified-user', () => ({
  deleteUnverifiedUser: (...args: unknown[]) => mockDeleteUnverifiedUser(...args),
}));

vi.mock('@/domain/auth/otp/otp', async () => {
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

vi.mock('@/domain/auth/responses/user.response', () => ({
  buildAuthUserFields: vi.fn().mockImplementation(async (user: { role: string; isEmailVerified: boolean }) => ({
    role: user.role,
    isActive: false,
    companyId: null,
    isOwner: null,
    approvalStatus: null,
  })),
}));

import { OtpError } from '@/domain/auth/otp/otp';
import { verifyEmail } from '@/features/auth/verify-email/verify-email.service';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const tokenJti = '770e8400-e29b-41d4-a716-446655440002';

const unverifiedUser = {
  _id: userId,
  role: 'buyer',
  isEmailVerified: false,
  verificationExpiresAt: new Date(Date.now() + 60_000),
  activeEmailVerifyJti: tokenJti,
};

describe('verifyEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-for-auth-tests';
    mockInvalidateAuthOtp.mockResolvedValue(undefined);
    mockDeleteUnverifiedUser.mockResolvedValue(undefined);
    mockUpdateUserById.mockResolvedValue({});
  });

  describe('token ile', () => {
    it('geçerli token ile e-postayı doğrular ve oturum tokeni döner', async () => {
      const token = signEmailVerificationToken(userId, tokenJti);

      mockFindById
        .mockResolvedValueOnce(unverifiedUser)
        .mockResolvedValueOnce({
          ...unverifiedUser,
          isEmailVerified: true,
        });

      const result = await verifyEmail({ token });

      expect(result.isEmailVerified).toBe(true);
      expect(result.token).toEqual(expect.any(String));
      expect(mockUpdateUserById).toHaveBeenCalled();
      expect(mockInvalidateAuthOtp).toHaveBeenCalledWith(userId, 'email_verify');
      expect(mockVerifyAuthOtp).not.toHaveBeenCalled();
    });

    it('satıcı doğrulandığında isActive true olur', async () => {
      const token = signEmailVerificationToken(userId, tokenJti);

      mockFindById
        .mockResolvedValueOnce({ ...unverifiedUser, role: 'seller' })
        .mockResolvedValueOnce({
          ...unverifiedUser,
          role: 'seller',
          isEmailVerified: true,
          isActive: true,
        });

      await verifyEmail({ token });

      expect(mockUpdateUserById).toHaveBeenCalledWith(userId, {
        $set: {
          isEmailVerified: true,
          verificationExpiresAt: null,
          activeEmailVerifyJti: null,
          isActive: true,
        },
      });
    });

    it('zaten doğrulanmış kullanıcıda 400 döner', async () => {
      const token = signEmailVerificationToken(userId, tokenJti);
      mockFindById.mockResolvedValue({
        ...unverifiedUser,
        isEmailVerified: true,
      });

      await expect(verifyEmail({ token })).rejects.toMatchObject({
        statusCode: 400,
        message: 'E-posta zaten doğrulanmış, giriş yapın',
      });
    });

    it('doğrulama süresi dolmuşsa kaydı siler ve 410 döner', async () => {
      const token = signEmailVerificationToken(userId, tokenJti);
      mockFindById.mockResolvedValue({
        ...unverifiedUser,
        verificationExpiresAt: new Date(Date.now() - 1_000),
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
      expect(mockFindOne).toHaveBeenCalledWith('user@example.com');
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
