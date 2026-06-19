import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindOne = vi.fn();
const mockCreateAuthOtp = vi.fn();
const mockInvalidateAuthOtp = vi.fn();
const mockSendPasswordResetEmail = vi.fn();
const mockAssertEmailCooldown = vi.fn();
const mockMarkPasswordResetEmailSent = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  User: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
  },
}));

vi.mock('@/internal/auth/otp/otp', () => ({
  createAuthOtp: (...args: unknown[]) => mockCreateAuthOtp(...args),
  invalidateAuthOtp: (...args: unknown[]) => mockInvalidateAuthOtp(...args),
}));

vi.mock('@/internal/auth/tokens/email-token', () => ({
  signPasswordResetToken: vi.fn().mockReturnValue('reset-token'),
}));

vi.mock('@/integrations/resend/send', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}));

vi.mock('@/internal/auth/mail/cooldown', async () => {
  const actual = await vi.importActual<typeof import('@/internal/auth/mail/cooldown')>(
    '@/internal/auth/mail/cooldown'
  );

  return {
    ...actual,
    assertEmailCooldown: (...args: unknown[]) => mockAssertEmailCooldown(...args),
    markPasswordResetEmailSent: (...args: unknown[]) => mockMarkPasswordResetEmailSent(...args),
  };
});

import { EmailCooldownError } from '@/internal/auth/mail/cooldown';
import { forgotPassword } from '@/features/auth/recovery/forgot-password/forgot-password.service';

describe('forgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAuthOtp.mockResolvedValue('482913');
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    mockInvalidateAuthOtp.mockResolvedValue(undefined);
    mockMarkPasswordResetEmailSent.mockResolvedValue(undefined);
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
  });

  it('cooldown içinde 429 döner', async () => {
    mockFindOne.mockResolvedValue({
      _id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      passwordResetEmailSentAt: new Date(),
    });
    mockAssertEmailCooldown.mockImplementation(() => {
      throw new EmailCooldownError(429, 'E-posta az önce gönderildi. 45 saniye sonra tekrar deneyin');
    });

    await expect(forgotPassword('user@example.com')).rejects.toMatchObject({
      statusCode: 429,
    });

    expect(mockCreateAuthOtp).not.toHaveBeenCalled();
  });

  it('mail gitmezse OTP iptal eder ve 503 döner', async () => {
    mockFindOne.mockResolvedValue({
      _id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
    });
    mockSendPasswordResetEmail.mockRejectedValue(new Error('Resend hatası'));

    await expect(forgotPassword('user@example.com')).rejects.toMatchObject({
      statusCode: 503,
      message: 'Şifre sıfırlama e-postası gönderilemedi, lütfen tekrar deneyin',
    });

    expect(mockInvalidateAuthOtp).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'password_reset'
    );
  });
});
