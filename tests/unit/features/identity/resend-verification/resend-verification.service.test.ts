import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindOne = vi.fn();
const mockSendUserVerificationEmail = vi.fn();
const mockAssertEmailCooldown = vi.fn();
const mockMarkVerificationEmailSent = vi.fn();
const mockInvalidateAuthOtp = vi.fn();

vi.mock('@/domains/identity/infrastructure/repositories/auth/user.repository', () => ({
  findUserByEmail: (...args: unknown[]) => mockFindOne(...args),
}));

vi.mock('@/domains/identity/application/mail/send-verification', () => ({
  sendUserVerificationEmail: (...args: unknown[]) => mockSendUserVerificationEmail(...args),
}));

vi.mock('@/domains/identity/application/otp/otp', () => ({
  invalidateAuthOtp: (...args: unknown[]) => mockInvalidateAuthOtp(...args),
}));

vi.mock('@/domains/identity/application/mail/cooldown', async () => {
  const actual = await vi.importActual<typeof import('@/domains/identity/application/mail/cooldown')>(
    '@/domains/identity/application/mail/cooldown'
  );

  return {
    ...actual,
    assertEmailCooldown: (...args: unknown[]) => mockAssertEmailCooldown(...args),
    markVerificationEmailSent: (...args: unknown[]) => mockMarkVerificationEmailSent(...args),
  };
});

import { EmailCooldownError } from '@/domains/identity/application/mail/cooldown';
import { resendVerificationEmail } from '@/api/auth/resend-verification/resend-verification.service';

describe('resendVerificationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendUserVerificationEmail.mockResolvedValue(undefined);
    mockMarkVerificationEmailSent.mockResolvedValue(undefined);
    mockInvalidateAuthOtp.mockResolvedValue(undefined);
    mockAssertEmailCooldown.mockImplementation(() => {});
  });

  it('kayıtlı olmayan e-postada sessizce döner', async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(resendVerificationEmail('ghost@example.com')).resolves.toBeUndefined();
    expect(mockSendUserVerificationEmail).not.toHaveBeenCalled();
  });

  it('cooldown içinde sessizce döner', async () => {
    mockFindOne.mockResolvedValue({
      _id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      isEmailVerified: false,
      verificationEmailSentAt: new Date(),
    });
    mockAssertEmailCooldown.mockImplementation(() => {
      throw new EmailCooldownError(429, 'E-posta az önce gönderildi. 50 saniye sonra tekrar deneyin');
    });

    await expect(resendVerificationEmail('user@example.com')).resolves.toBeUndefined();
    expect(mockSendUserVerificationEmail).not.toHaveBeenCalled();
  });

  it('mail gitmezse OTP iptal eder ve sessizce döner', async () => {
    mockFindOne.mockResolvedValue({
      _id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      isEmailVerified: false,
    });
    mockSendUserVerificationEmail.mockRejectedValue(new Error('Resend hatası'));

    await expect(resendVerificationEmail('user@example.com')).resolves.toBeUndefined();

    expect(mockInvalidateAuthOtp).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'email_verify'
    );
  });
});
