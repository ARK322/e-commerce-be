import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindOne = vi.fn();
const mockCreateAuthOtp = vi.fn();
const mockInvalidateAuthOtp = vi.fn();
const mockSendPasswordResetEmail = vi.fn();
const mockAssertEmailCooldown = vi.fn();
const mockMarkPasswordResetEmailSent = vi.fn();
const mockUpdateUserById = vi.fn();

vi.mock('@/repositories/auth/user.repository', () => ({
  findUserByEmail: (...args: unknown[]) => mockFindOne(...args),
  updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
}));

vi.mock('@/domain/auth/otp/otp', () => ({
  createAuthOtp: (...args: unknown[]) => mockCreateAuthOtp(...args),
  invalidateAuthOtp: (...args: unknown[]) => mockInvalidateAuthOtp(...args),
}));

vi.mock('@/domain/auth/tokens/email-token', () => ({
  signPasswordResetToken: vi.fn().mockReturnValue('reset-token'),
}));

vi.mock('@/infrastructure/resend/send', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}));

vi.mock('@/domain/auth/mail/cooldown', async () => {
  const actual = await vi.importActual<typeof import('@/domain/auth/mail/cooldown')>(
    '@/domain/auth/mail/cooldown'
  );

  return {
    ...actual,
    assertEmailCooldown: (...args: unknown[]) => mockAssertEmailCooldown(...args),
    markPasswordResetEmailSent: (...args: unknown[]) => mockMarkPasswordResetEmailSent(...args),
  };
});

import { EmailCooldownError } from '@/domain/auth/mail/cooldown';
import { forgotPassword } from '@/features/auth/forgot-password/forgot-password.service';

describe('forgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAuthOtp.mockResolvedValue('482913');
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    mockInvalidateAuthOtp.mockResolvedValue(undefined);
    mockMarkPasswordResetEmailSent.mockResolvedValue(undefined);
    mockUpdateUserById.mockResolvedValue({});
    mockAssertEmailCooldown.mockImplementation(() => {});
  });

  it('kayıtlı olmayan e-postada sessizce döner', async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(forgotPassword('ghost@example.com')).resolves.toBeUndefined();
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('mail giderse OTP oluşturup mail gönderir', async () => {
    mockFindOne.mockResolvedValue({
      _id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
    });

    await forgotPassword('user@example.com');

    expect(mockCreateAuthOtp).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'password_reset'
    );
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      'user@example.com',
      'reset-token',
      '482913'
    );
    expect(mockMarkPasswordResetEmailSent).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    expect(mockUpdateUserById).toHaveBeenCalled();
  });

  it('cooldown içinde sessizce döner', async () => {
    mockFindOne.mockResolvedValue({
      _id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      passwordResetEmailSentAt: new Date(),
    });
    mockAssertEmailCooldown.mockImplementation(() => {
      throw new EmailCooldownError(429, 'E-posta az önce gönderildi. 45 saniye sonra tekrar deneyin');
    });

    await expect(forgotPassword('user@example.com')).resolves.toBeUndefined();
    expect(mockCreateAuthOtp).not.toHaveBeenCalled();
  });

  it('mail gitmezse OTP iptal eder ve sessizce döner', async () => {
    mockFindOne.mockResolvedValue({
      _id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
    });
    mockSendPasswordResetEmail.mockRejectedValue(new Error('Resend hatası'));

    await expect(forgotPassword('user@example.com')).resolves.toBeUndefined();

    expect(mockInvalidateAuthOtp).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'password_reset'
    );
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });
});
