import { beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAuthToken, verifyAuthToken } from '@/domain/auth/tokens/access-token';

const userId = '550e8400-e29b-41d4-a716-446655440000';

describe('access-token', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
  });

  it('buyer token imzalar ve doğrular', () => {
    const token = signAuthToken(userId, 'buyer');

    const payload = verifyAuthToken(token);

    expect(payload).toEqual({ userId, role: 'buyer' });
  });

  it('rememberMe ile token üretir', () => {
    const token = signAuthToken(userId, 'seller', true);
    const decoded = jwt.decode(token) as jwt.JwtPayload;

    expect(decoded.role).toBe('seller');
    expect(decoded.sub).toBe(userId);
    expect(decoded.purpose).toBe('access');
  });

  it('geçersiz token reddedilir', () => {
    expect(() => verifyAuthToken('invalid.token.here')).toThrow();
  });

  it('purpose access değilse reddedilir', () => {
    const token = jwt.sign({ purpose: 'email', role: 'buyer' }, process.env.JWT_SECRET!, {
      subject: userId,
      expiresIn: '1h',
    });

    expect(() => verifyAuthToken(token)).toThrow('Geçersiz token');
  });

  it('JWT_SECRET yoksa hata fırlatır', () => {
    delete process.env.JWT_SECRET;

    expect(() => signAuthToken(userId, 'buyer')).toThrow('JWT_SECRET tanımlanmamış');
  });
});
