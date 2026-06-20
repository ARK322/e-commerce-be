import { describe, expect, it } from 'vitest';
import {
  resolveOrderUnitPrice,
} from '@/internal/buyers/orders/order-item-validation';

describe('resolveOrderUnitPrice', () => {
  it('snapshot güncel fiyata yakınsa katalog fiyatını kullanır', () => {
    expect(resolveOrderUnitPrice(999, 999)).toBe(999);
    expect(resolveOrderUnitPrice(990, 999)).toBe(999);
  });

  it('snapshot yoksa ürün fiyatını kullanır', () => {
    expect(resolveOrderUnitPrice(null, 999)).toBe(999);
    expect(resolveOrderUnitPrice(undefined, 999)).toBe(999);
  });

  it('geçersiz snapshot için ürün fiyatına döner', () => {
    expect(resolveOrderUnitPrice(-1, 999)).toBe(999);
    expect(resolveOrderUnitPrice(Number.NaN, 999)).toBe(999);
    expect(resolveOrderUnitPrice(0, 999)).toBe(999);
  });

  it('snapshot katalog fiyatından yüksekse katalog fiyatına çeker', () => {
    expect(resolveOrderUnitPrice(1200, 999)).toBe(999);
  });

  it('fiyat artışında kilitli snapshot fiyatını korur', () => {
    expect(resolveOrderUnitPrice(850, 999)).toBe(850);
  });
});
