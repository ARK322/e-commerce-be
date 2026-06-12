import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../../common/password';

const mockFindOneAndUpdate = vi.fn();
const mockFindOne = vi.fn();
const mockDeleteOne = vi.fn();

vi.mock('../../../db', () => ({
  AuthOtp: {
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
    findOne: (...args: unknown[]) => mockFindOne(...args),
    deleteOne: (...args: unknown[]) => mockDeleteOne(...args),
  },
}));

import { createAuthOtp, generateOtpCode, OtpError, verifyAuthOtp } from './otp';

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
    mockFindOneAndUpdate.mockResolvedValue({});
  });

  it('kodu hashleyerek upsert eder', async () => {
    const code = await createAuthOtp('507f1f77bcf86cd799439011', 'email_verify');

    expect(code).toMatch(/^\d{6}$/);
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: '507f1f77bcf86cd799439011', purpose: 'email_verify' },
      expect.objectContaining({
        codeHash: expect.any(String),
        expiresAt: expect.any(Date),
        attemptCount: 0,
      }),
      { upsert: true, returnDocument: 'after' }
    );

    const storedHash = mockFindOneAndUpdate.mock.calls[0][1].codeHash;
    expect(storedHash).not.toBe(code);
  });
});

describe('verifyAuthOtp', () => {
  const userId = '507f1f77bcf86cd799439011';
  const purpose = 'email_verify' as const;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteOne.mockResolvedValue({});
  });

  it('doğru kod ile OTP kaydını siler', async () => {
    const code = '482913';
    const codeHash = await hashPassword(code);

    mockFindOne.mockResolvedValue({
      _id: 'otp-id',
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
      codeHash,
      save: vi.fn(),
    });

    await verifyAuthOtp(userId, purpose, code);

    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: 'otp-id' });
  });

  it('kayıt yoksa 400 döner', async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(verifyAuthOtp(userId, purpose, '123456')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Doğrulama kodu geçersiz veya süresi dolmuş',
    });
  });

  it('süresi dolmuş kodda 410 döner ve kaydı siler', async () => {
    mockFindOne.mockResolvedValue({
      _id: 'otp-id',
      expiresAt: new Date(Date.now() - 1_000),
      attemptCount: 0,
      codeHash: 'hash',
      save: vi.fn(),
    });

    await expect(verifyAuthOtp(userId, purpose, '123456')).rejects.toMatchObject({
      statusCode: 410,
      message: 'Doğrulama kodunun süresi doldu',
    });

    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: 'otp-id' });
  });

  it('hatalı kodda deneme sayısını artırır', async () => {
    const codeHash = await hashPassword('482913');
    const save = vi.fn();
    mockFindOne.mockResolvedValue({
      _id: 'otp-id',
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
    mockFindOne.mockResolvedValue({
      _id: 'otp-id',
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 4,
      codeHash,
      save,
    });

    await expect(verifyAuthOtp(userId, purpose, '000000')).rejects.toMatchObject({
      statusCode: 429,
      message: 'Çok fazla hatalı deneme. Yeni kod isteyin',
    });

    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: 'otp-id' });
  });
});
