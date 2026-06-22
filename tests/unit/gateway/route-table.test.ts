import { describe, expect, it } from 'vitest';
import { resolveRoute, resolveUpstreams } from '@/gateway/route-table';

const upstreams = {
  catalog: 'http://catalog:3000',
  identity: 'http://identity:3000',
  monolith: 'http://api:3000',
};

describe('resolveRoute (Strangler-Fig)', () => {
  it('/auth → identity (migrated)', () => {
    const { route, upstream } = resolveRoute('/auth/login', upstreams);
    expect(upstream).toBe('http://identity:3000');
    expect(route.migrated).toBe(true);
  });

  it('/products → catalog (migrated)', () => {
    const { route, upstream } = resolveRoute('/products?limit=10', upstreams);
    expect(upstream).toBe('http://catalog:3000');
    expect(route.migrated).toBe(true);
  });

  it('/categories → catalog (migrated)', () => {
    expect(resolveRoute('/categories', upstreams).upstream).toBe('http://catalog:3000');
  });

  it('taşınmamış /cart → monolit fallback', () => {
    const { route, upstream } = resolveRoute('/cart/items', upstreams);
    expect(upstream).toBe('http://api:3000');
    expect(route.migrated).toBe(false);
  });

  it('bilinmeyen rota → monolit fallback', () => {
    expect(resolveRoute('/orders/123', upstreams).upstream).toBe('http://api:3000');
  });

  it('prefix kısmi eşleşmeyi yanlış yakalamaz (/productsX ≠ /products)', () => {
    expect(resolveRoute('/productsX', upstreams).upstream).toBe('http://api:3000');
  });
});

describe('resolveUpstreams', () => {
  it('default olarak taşınmamış servisleri monolit\'e düşürür', () => {
    const resolved = resolveUpstreams({ GATEWAY_MONOLITH_UPSTREAM: 'http://mono:9000' } as NodeJS.ProcessEnv);
    expect(resolved.catalog).toBe('http://mono:9000');
    expect(resolved.identity).toBe('http://mono:9000');
    expect(resolved.monolith).toBe('http://mono:9000');
  });

  it('açık upstream override\'larını kullanır', () => {
    const resolved = resolveUpstreams({
      GATEWAY_MONOLITH_UPSTREAM: 'http://mono:9000',
      GATEWAY_CATALOG_UPSTREAM: 'http://cat:9000',
    } as NodeJS.ProcessEnv);
    expect(resolved.catalog).toBe('http://cat:9000');
    expect(resolved.monolith).toBe('http://mono:9000');
  });
});
