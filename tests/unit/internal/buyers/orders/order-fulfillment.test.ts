import { describe, expect, it } from 'vitest';
import {
  assertSellerItemStatusTransition,
  computeAggregateOrderStatus,
  computeSellerSubtotal,
} from '@/internal/buyers/orders/order-fulfillment';
import { CommerceError } from '@/internal/common/errors/commerce-error';

describe('order-fulfillment', () => {
  it('tüm kalemler delivered ise sipariş delivered olur', () => {
    expect(
      computeAggregateOrderStatus([
        { sellerId: 's1', fulfillmentStatus: 'delivered' },
        { sellerId: 's2', fulfillmentStatus: 'delivered' },
      ])
    ).toBe('delivered');
  });

  it('tüm kalemler shipped veya delivered ise sipariş shipped olur', () => {
    expect(
      computeAggregateOrderStatus([
        { sellerId: 's1', fulfillmentStatus: 'shipped' },
        { sellerId: 's2', fulfillmentStatus: 'delivered' },
      ])
    ).toBe('shipped');
  });

  it('satıcı alt toplamını hesaplar', () => {
    expect(
      computeSellerSubtotal(
        [
          { sellerId: 's1', subtotal: 100 },
          { sellerId: 's2', subtotal: 200 },
          { sellerId: 's1', subtotal: 50 },
        ],
        's1'
      )
    ).toBe(150);
  });

  it('pending kalem delivered yapılamaz', () => {
    expect(() => assertSellerItemStatusTransition('pending', 'delivered')).toThrow(CommerceError);
  });
});
