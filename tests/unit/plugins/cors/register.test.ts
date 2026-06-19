import { afterEach, describe, expect, it, vi } from 'vitest';
import { corsOriginHandler, getAllowedOrigins } from '@/plugins/cors/register';

describe('getAllowedOrigins', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('FRONTEND_URL virgülle ayrılmış origin listesini parse eder', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com, https://preview.example.com',
      CORS_ORIGINS: undefined,
    };

    expect(getAllowedOrigins()).toEqual([
      'https://app.example.com',
      'https://preview.example.com',
    ]);
  });

  it('production ortamında env yoksa boş liste döner', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      FRONTEND_URL: '',
      CORS_ORIGINS: undefined,
    };

    expect(getAllowedOrigins()).toEqual([]);
  });

  it('development ortamında localhost fallback verir', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      FRONTEND_URL: '',
      CORS_ORIGINS: undefined,
    };

    expect(getAllowedOrigins()).toContain('http://localhost:3000');
  });
});

describe('corsOriginHandler', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('origin header yoksa izin verir', () => {
    const callback = vi.fn();

    corsOriginHandler(undefined, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('izinli origin kabul edilir', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
      CORS_ORIGINS: undefined,
    };

    const callback = vi.fn();

    corsOriginHandler('https://app.example.com', callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('izinli olmayan origin Error fırlatmaz', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
      CORS_ORIGINS: undefined,
    };

    const callback = vi.fn();

    corsOriginHandler('https://evil.example.com', callback);

    expect(callback).toHaveBeenCalledWith(null, false);
  });
});
