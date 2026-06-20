import { afterEach, describe, expect, it, vi } from 'vitest';
import { env, validateEnvAtStartup } from '@/config/env';

describe('env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('PORT yoksa varsayılan 8080 döner', () => {
    vi.unstubAllEnvs();
    delete process.env.PORT;

    expect(env.port).toBe(8080);
  });

  it('geçersiz PORT için hata fırlatır', () => {
    vi.stubEnv('PORT', 'abc');

    expect(() => env.port).toThrow('PORT geçersiz bir sayı');
  });

  it('mongoUri alias sırasını uygular', () => {
    vi.stubEnv('MONGO_URI', 'mongodb://first');
    vi.stubEnv('DATABASE_URL', 'mongodb://second');

    expect(env.mongoUri).toBe('mongodb://first');
  });

  it('CORS_ORIGINS virgülle ayrılmış origin listesi döner', () => {
    vi.stubEnv('CORS_ORIGINS', 'https://a.test, https://b.test');

    expect(env.allowedOrigins).toEqual(['https://a.test', 'https://b.test']);
  });
});

describe('validateEnvAtStartup', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('zorunlu değişkenler eksikse hata fırlatır', () => {
    vi.unstubAllEnvs();
    delete process.env.JWT_SECRET;
    delete process.env.PLATFORM_COMMISSION_RATE;
    delete process.env.MONGO_URI;

    expect(() => validateEnvAtStartup()).toThrow(/JWT_SECRET/);
  });

  it('zorunlu değişkenler tamamsa geçer', () => {
    vi.stubEnv('MONGO_URI', 'mongodb://localhost:27017/test');
    vi.stubEnv('JWT_SECRET', 'test-secret-with-at-least-32-characters-long');
    vi.stubEnv('PLATFORM_COMMISSION_RATE', '0.10');

    expect(() => validateEnvAtStartup()).not.toThrow();
  });
});
