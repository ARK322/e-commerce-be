import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '@/shared/security';

const mockUpsertAuthOtp = vi.fn();
const mockFindAuthOtpById = vi.fn();
const mockDeleteAuthOtpById = vi.fn();
const mockSaveAuthOtpDocument = vi.fn();

vi.mock('@/domains/identity/infrastructure/repositories/auth/auth-otp.repository', () => ({
  upsertAuthOtp: (...args: unknown[]) => mockUpsertAuthOtp(...args),
  findAuthOtpById: (...args: unknown[]) => mockFindAuthOtpById(...args),
  deleteAuthOtpById: (...args: unknown[]) => mockDeleteAuthOtpById(...args),
  saveAuthOtpDocument: (...args: unknown[]) => mockSaveAuthOtpDocument(...args),
}));

import { createAuthOtp, generateOtpCode, OtpError, verifyAuthOtp } from '@/domains/identity/application/otp/otp';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const otpId = `${userId}:email_verify`;

describe('generateOtpCode', () => {
  it('6 haneli sayısal kod üretir', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe('createAuthOtp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertAuthOtp.mockResolvedValue({});
  });

  it('kodu hashleyerek upsert eder', async () => {
    const code = await createAuthOtp(userId, 'email_verify');

    expect(code).toMatch(/^\d{6}$/);
    expect(mockUpsertAuthOtp).toHaveBeenCalledWith(
      otpId,
      expect.objectContaining({
        codeHash: expect.any(String),
        expiresAt: expect.any(Date),
        attemptCount: 0,
      })
    );

    const storedHash = mockUpsertAuthOtp.mock.calls[0][1].codeHash;
    expect(storedHash).not.toBe(code);
  });
});

describe('verifyAuthOtp', () => {
  const purpose = 'email_verify' as const;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteAuthOtpById.mockResolvedValue({});
    mockSaveAuthOtpDocument.mockImplementation((otp: { save: () => Promise<unknown> }) => otp.save());
  });

  it('doğru kod ile OTP kaydını siler', async () => {
    const code = '482913';
    const codeHash = await hashPassword(code);

    mockFindAuthOtpById.mockResolvedValue({
      _id: otpId,
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
      codeHash,
      save: vi.fn(),
    });

    await verifyAuthOtp(userId, purpose, code);

    expect(mockDeleteAuthOtpById).toHaveBeenCalledWith(otpId);
  });

  it('kayıt yoksa 400 döner', async () => {
    mockFindAuthOtpById.mockResolvedValue(null);

    await expect(verifyAuthOtp(userId, purpose, '123456')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Doğrulama kodu geçersiz veya süresi dolmuş',
    });
  });

  it('süresi dolmuş kodda 410 döner ve kaydı siler', async () => {
    mockFindAuthOtpById.mockResolvedValue({
      _id: otpId,
      expiresAt: new Date(Date.now() - 1_000),
      attemptCount: 0,
      codeHash: 'hash',
      save: vi.fn(),
    });

    await expect(verifyAuthOtp(userId, purpose, '123456')).rejects.toMatchObject({
      statusCode: 410,
      message: 'Doğrulama kodunun süresi doldu',
    });

    expect(mockDeleteAuthOtpById).toHaveBeenCalledWith(otpId);
  });

  it('hatalı kodda deneme sayısını artırır', async () => {
    const codeHash = await hashPassword('482913');
    const save = vi.fn();
    mockFindAuthOtpById.mockResolvedValue({
      _id: otpId,
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
      codeHash,
      save,
    });

    await expect(verifyAuthOtp(userId, purpose, '000000')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Doğrulama kodu hatalı',
    });

    expect(save).toHaveBeenCalled();
  });

  it('5 hatalı denemeden sonra 429 döner ve kaydı siler', async () => {
    const codeHash = await hashPassword('482913');
    const save = vi.fn();
    mockFindAuthOtpById.mockResolvedValue({
      _id: otpId,
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 4,
      codeHash,
      save,
    });

    await expect(verifyAuthOtp(userId, purpose, '000000')).rejects.toMatchObject({
      statusCode: 429,
      message: 'Çok fazla hatalı deneme. Yeni kod isteyin',
    });

    expect(mockDeleteAuthOtpById).toHaveBeenCalledWith(otpId);
  });
});
