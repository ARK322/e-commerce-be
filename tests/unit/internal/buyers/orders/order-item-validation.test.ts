import { describe, expect, it } from 'vitest';
import {
  resolveOrderUnitPrice,
} from '@/domains/commerce/application/orders/order-item-validation';

describe('resolveOrderUnitPrice', () => {
  it('her zaman güncel ürün fiyatını kullanır', () => {
    expect(resolveOrderUnitPrice(999, 999)).toBe(999);
    expect(resolveOrderUnitPrice(850, 999)).toBe(999);
    expect(resolveOrderUnitPrice(null, 999)).toBe(999);
    expect(resolveOrderUnitPrice(undefined, 999)).toBe(999);
    expect(resolveOrderUnitPrice(1200, 999)).toBe(999);
  });
});
