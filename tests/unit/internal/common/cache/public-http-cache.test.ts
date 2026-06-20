import { describe, expect, it } from 'vitest';
import {
  PUBLIC_HTTP_CACHE,
  setPublicCacheControl,
} from '@/internal/common/cache/public-http-cache';

describe('public-http-cache', () => {
  it('Cache-Control preset değerlerini tanımlar', () => {
    expect(PUBLIC_HTTP_CACHE.categories).toContain('max-age=60');
    expect(PUBLIC_HTTP_CACHE.productsList).toContain('max-age=30');
    expect(PUBLIC_HTTP_CACHE.productDetail).toContain('max-age=60');
  });

  it('reply header set eder', () => {
    const headers: Record<string, string> = {};

    setPublicCacheControl(
      {
        header(name: string, value: string) {
          headers[name] = value;
        },
      } as never,
      'productsList'
    );

    expect(headers['Cache-Control']).toBe(PUBLIC_HTTP_CACHE.productsList);
  });
});
