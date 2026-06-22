import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMemoryCache, memoryCache } from '@/domains/catalog/infrastructure/cache/memory-cache';

describe('memoryCache', () => {
  beforeEach(() => {
    clearMemoryCache();
    vi.useRealTimers();
  });

  it('set sonrası get değeri döner', () => {
    memoryCache.set('key', { ok: true }, { ttlMs: 60_000 });

    expect(memoryCache.get('key')).toEqual({ ok: true });
  });

  it('TTL dolunca get undefined döner', () => {
    vi.useFakeTimers();

    memoryCache.set('key', 'value', { ttlMs: 1_000 });
    vi.advanceTimersByTime(1_001);

    expect(memoryCache.get('key')).toBeUndefined();
  });

  it('deleteByPrefix ilgili keyleri siler', () => {
    memoryCache.set('catalog:products:a', 1, { ttlMs: 60_000 });
    memoryCache.set('catalog:products:b', 2, { ttlMs: 60_000 });
    memoryCache.set('catalog:categories:x', 3, { ttlMs: 60_000 });

    memoryCache.deleteByPrefix('catalog:products:');

    expect(memoryCache.get('catalog:products:a')).toBeUndefined();
    expect(memoryCache.get('catalog:products:b')).toBeUndefined();
    expect(memoryCache.get('catalog:categories:x')).toBe(3);
  });
});
