import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindOne = vi.fn();
const mockCreate = vi.fn();
const mockBuyerCreate = vi.fn();
const mockSellerCreate = vi.fn();
const mockDeleteUnverifiedUser = vi.fn();
const mockSendVerification = vi.fn();
const mockAssertRegisterEmailCooldown = vi.fn();
const mockMarkRegisterEmailCooldown = vi.fn();
const mockMarkVerificationEmailSent = vi.fn();
const mockInvalidateAuthOtp = vi.fn();

vi.mock('@/infrastructure/mongo', () => ({
  User: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    findByIdAndUpdate: vi.fn().mockResolvedValue({}),
  },
  Buyer: {
    create: (...args: unknown[]) => mockBuyerCreate(...args),
  },
  Seller: {
    create: (...args: unknown[]) => mockSellerCreate(...args),
  },
}));

vi.mock('@/domain/auth/mail/cooldown', async () => {
  const actual = await vi.importActual<typeof import('@/domain/auth/mail/cooldown')>(
    '@/domain/auth/mail/cooldown'
  );
  return {
    ...actual,
    assertRegisterEmailCooldown: (...args: unknown[]) => mockAssertRegisterEmailCooldown(...args),
    markRegisterEmailCooldown: (...args: unknown[]) => mockMarkRegisterEmailCooldown(...args),
    markVerificationEmailSent: (...args: unknown[]) => mockMarkVerificationEmailSent(...args),
  };
});

vi.mock('@/domain/auth/otp/otp', () => ({
  invalidateAuthOtp: (...args: unknown[]) => mockInvalidateAuthOtp(...args),
}));

vi.mock('@/domain/auth/register/unverified-user', () => ({
  deleteUnverifiedUser: (...args: unknown[]) => mockDeleteUnverifiedUser(...args),
  getVerificationExpiresAt: () => new Date(Date.now() + 86_400_000),
}));

vi.mock('@/domain/auth/mail/send-verification', () => ({
  sendUserVerificationEmail: (...args: unknown[]) => mockSendVerification(...args),
}));

const mockCreateUserId = vi.fn();

vi.mock('@/shared/ids', () => ({
  createUserId: () => mockCreateUserId(),
}));

vi.mock('@/shared/security', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
}));

vi.mock('@/domain/auth/responses/user.response', () => ({
  buildAuthUserFields: vi.fn().mockImplementation(async (user: { role: string }) => ({
    role: user.role,
    isActive: false,
    companyId: null,
    isOwner: null,
    approvalStatus: null,
  })),
}));

import { register } from '@/features/auth/register/register.service';

const existingUserId = '550e8400-e29b-41d4-a716-446655440000';
const newUserId = '550e8400-e29b-41d4-a716-446655440001';

describe('register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateUserId.mockReturnValue(newUserId);
    mockBuyerCreate.mockResolvedValue({});
    mockAssertRegisterEmailCooldown.mockResolvedValue(undefined);
    mockMarkRegisterEmailCooldown.mockResolvedValue(undefined);
    mockSendVerification.mockResolvedValue(undefined);
    mockMarkVerificationEmailSent.mockResolvedValue(undefined);
    mockInvalidateAuthOtp.mockResolvedValue(undefined);
  });

  it('doğrulanmamış eski kaydı silip yeniden kayıt oluşturur', async () => {
    mockFindOne.mockResolvedValue({
      _id: existingUserId,
      isEmailVerified: false,
    });
    mockCreate.mockResolvedValue({
      _id: newUserId,
      email: 'user@example.com',
      role: 'buyer',
      isEmailVerified: false,
    });

    const result = await register({
      email: 'user@example.com',
      password: 'SecurePass1',
      role: 'buyer',
    });

    expect(mockDeleteUnverifiedUser).toHaveBeenCalledWith(existingUserId);
    expect(mockMarkRegisterEmailCooldown).toHaveBeenCalledWith('user@example.com');
    expect(result).toEqual({
      message: 'Kayıt talebiniz alındı. E-posta kutunuzu kontrol edin.',
    });
  });

  it('cooldown aktifken genel onay mesajı döner', async () => {
    const { EmailCooldownError } = await import('@/domain/auth/mail/cooldown');

    mockAssertRegisterEmailCooldown.mockRejectedValue(
      new EmailCooldownError(429, 'E-posta gönderimleri arasında bekleme süresi var')
    );

    const result = await register({
      email: 'user@example.com',
      password: 'SecurePass1',
      role: 'buyer',
    });

    expect(result).toEqual({
      message: 'Kayıt talebiniz alındı. E-posta kutunuzu kontrol edin.',
    });
  });

  it('mail gönderilemezse kaydı siler ve genel onay mesajı döner', async () => {
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      _id: newUserId,
      email: 'user@example.com',
      role: 'buyer',
      isEmailVerified: false,
    });
    mockSendVerification.mockRejectedValue(new Error('Resend hatası'));

    const result = await register({
      email: 'user@example.com',
      password: 'SecurePass1',
      role: 'buyer',
    });

    expect(result).toEqual({
      message: 'Kayıt talebiniz alındı. E-posta kutunuzu kontrol edin.',
    });
    expect(mockDeleteUnverifiedUser).toHaveBeenCalledWith(newUserId);
  });

  it('doğrulanmış e-postada genel onay mesajı döner', async () => {
    mockFindOne.mockResolvedValue({
      _id: existingUserId,
      isEmailVerified: true,
    });

    const result = await register({
      email: 'user@example.com',
      password: 'SecurePass1',
      role: 'buyer',
    });

    expect(result).toEqual({
      message: 'Kayıt talebiniz alındı. E-posta kutunuzu kontrol edin.',
    });
  });
});
