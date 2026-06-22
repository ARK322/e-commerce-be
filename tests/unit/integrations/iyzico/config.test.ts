import { afterEach, describe, expect, it } from 'vitest';
import { getPaymentConfig } from '@/infrastructure/iyzico/config';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getPaymentConfig', () => {
  it('sandbox anahtarı ile sandbox uri seçer', () => {
    process.env.IYZIPAY_API_KEY = 'sandbox-test-key';
    process.env.IYZIPAY_SECRET_KEY = 'sandbox-test-secret';
    process.env.API_BASE_URL = 'http://localhost:8080';

    expect(getPaymentConfig()).toEqual({
      apiKey: 'sandbox-test-key',
      secretKey: 'sandbox-test-secret',
      uri: 'https://sandbox-api.iyzipay.com',
      callbackUrl: 'http://localhost:8080/payments/callback',
    });
  });

  it('production anahtarı ile production uri seçer', () => {
    process.env.IYZIPAY_API_KEY = 'live-test-key';
    process.env.IYZIPAY_SECRET_KEY = 'live-test-secret';
    process.env.IYZIPAY_URI = 'https://api.iyzipay.com';
    process.env.IYZIPAY_CALLBACK_URL = 'https://api.example.com/payments/callback';

    const config = getPaymentConfig();

    expect(config.uri).toBe('https://api.iyzipay.com');
    expect(config.callbackUrl).toBe('https://api.example.com/payments/callback');
  });

  it('anahtarlar eksikse hata fırlatır', () => {
    delete process.env.IYZIPAY_API_KEY;
    delete process.env.IYZIPAY_SECRET_KEY;

    expect(() => getPaymentConfig()).toThrow('IYZIPAY_API_KEY ve IYZIPAY_SECRET_KEY tanımlı olmalı');
  });
});
