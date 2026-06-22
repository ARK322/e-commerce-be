import { describe, expect, it } from 'vitest';
import {
  getDefaultScopesForRole,
  hasScope,
  normalizeScopes,
  WILDCARD_SCOPE,
} from '@/domains/identity/application/access/scopes';

describe('scopes katalogu', () => {
  it('buyer varsayılan scope seti sepet/sipariş yetkilerini içerir', () => {
    const scopes = getDefaultScopesForRole('buyer');
    expect(scopes).toContain('products:read');
    expect(scopes).toContain('cart:write');
    expect(scopes).toContain('orders:create');
    expect(scopes).not.toContain('products:write');
  });

  it('seller varsayılan scope seti ürün/fulfillment yetkilerini içerir', () => {
    const scopes = getDefaultScopesForRole('seller');
    expect(scopes).toContain('products:write');
    expect(scopes).toContain('fulfillment:manage');
  });

  it('admin wildcard scope alır', () => {
    expect(getDefaultScopesForRole('admin')).toEqual([WILDCARD_SCOPE]);
  });

  it('hasScope: wildcard her şeyi karşılar', () => {
    expect(hasScope([WILDCARD_SCOPE], 'products:write')).toBe(true);
    expect(hasScope(['products:read'], 'products:read')).toBe(true);
    expect(hasScope(['products:read'], 'products:write')).toBe(false);
  });

  it('normalizeScopes: geçerli dizi korunur', () => {
    expect(normalizeScopes(['cart:write'], 'buyer')).toEqual(['cart:write']);
  });

  it('normalizeScopes: dizi yoksa/boşsa role varsayılanına döner (geriye uyumluluk)', () => {
    expect(normalizeScopes(undefined, 'seller')).toEqual(getDefaultScopesForRole('seller'));
    expect(normalizeScopes([], 'buyer')).toEqual(getDefaultScopesForRole('buyer'));
    expect(normalizeScopes('not-an-array', 'admin')).toEqual([WILDCARD_SCOPE]);
  });
});
