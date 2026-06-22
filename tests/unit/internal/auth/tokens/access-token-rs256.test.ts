import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { signAuthToken, verifyAuthToken } from '@/domains/identity/application/tokens/access-token';

const userId = '550e8400-e29b-41d4-a716-446655440000';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

describe('access-token RS256 (Faz 3 dağıtık auth)', () => {
  beforeEach(() => {
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
    process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
  });

  afterEach(() => {
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
  });

  it('RS256 anahtarı tanımlıysa token RS256 ile imzalanır ve public key ile doğrulanır', () => {
    process.env.JWT_PRIVATE_KEY = privateKey;
    process.env.JWT_PUBLIC_KEY = publicKey;

    const token = signAuthToken(userId, 'seller');
    const header = (jwt.decode(token, { complete: true }) as jwt.Jwt).header;

    expect(header.alg).toBe('RS256');
    expect(verifyAuthToken(token)).toMatchObject({ userId, role: 'seller' });
  });

  it('RS256 anahtarı yokken HS256 ile geriye uyumlu çalışır', () => {
    const token = signAuthToken(userId, 'buyer');
    const header = (jwt.decode(token, { complete: true }) as jwt.Jwt).header;

    expect(header.alg).toBe('HS256');
    expect(verifyAuthToken(token)).toMatchObject({ userId, role: 'buyer' });
  });

  it('HS256 token, RS256 public key varken bile HMAC secret ile doğrulanır (geçiş dönemi)', () => {
    // Önce HS256 token üret (anahtarsız), sonra RS256 anahtarlarını aç.
    const legacyToken = signAuthToken(userId, 'admin');

    process.env.JWT_PRIVATE_KEY = privateKey;
    process.env.JWT_PUBLIC_KEY = publicKey;

    expect(verifyAuthToken(legacyToken)).toMatchObject({ userId, role: 'admin' });
  });

  it('algoritma karıştırma saldırısı: public key HMAC secret olarak kullanılan token reddedilir', () => {
    process.env.JWT_PRIVATE_KEY = privateKey;
    process.env.JWT_PUBLIC_KEY = publicKey;

    // Saldırgan public key'i HS256 secret gibi kullanarak token forge etmeye çalışır.
    const forged = jwt.sign({ purpose: 'access', role: 'admin' }, publicKey, {
      subject: userId,
      algorithm: 'HS256',
    });

    expect(() => verifyAuthToken(forged)).toThrow();
  });
});
