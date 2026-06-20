import { describe, expect, it } from 'vitest';
import {
  resolveOrderUnitPrice,
} from '@/internal/buyers/orders/order-item-validation';

describe('resolveOrderUnitPrice', () => {
  it('geçerli priceSnapshot varsa onu kullanır', () => {
    expect(resolveOrderUnitPrice(850, 999)).toBe(850);
  });

  it('snapshot yoksa ürün fiyatını kullanır', () => {
    expect(resolveOrderUnitPrice(null, 999)).toBe(999);
    expect(resolveOrderUnitPrice(undefined, 999)).toBe(999);
  });

  it('geçersiz snapshot için ürün fiyatına döner', () => {
    expect(resolveOrderUnitPrice(-1, 999)).toBe(999);
    expect(resolveOrderUnitPrice(Number.NaN, 999)).toBe(999);
  });
});
