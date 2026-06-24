import { describe, expect, it } from 'vitest';
import { CommerceError } from '@/shared/errors/commerce-error';
import {
  calculateReturnRefundAmount,
  isFullOrderReturn,
} from '@/domain/orders/return-refund-amount';

const orderItems = [
  { productId: 'p1', quantity: 2, subtotal: 200 },
  { productId: 'p2', quantity: 1, subtotal: 150 },
];

describe('calculateReturnRefundAmount', () => {
  it('cancellation tipinde kalan tutarın tamamını iade eder', () => {
    const amount = calculateReturnRefundAmount(
      { items: orderItems, totalAmount: 350 },
      [{ productId: 'p1', quantity: 1 }],
      'cancellation',
      { amount: 350, refundedAmount: 100 }
    );

    expect(amount).toBe(250);
  });

  it('kısmi iade için kalem bazlı tutar hesaplar', () => {
    const amount = calculateReturnRefundAmount(
      { items: orderItems, totalAmount: 350 },
      [{ productId: 'p1', quantity: 1 }],
      'return',
      { amount: 350, refundedAmount: 0 }
    );

    expect(amount).toBe(100);
  });

  it('birden fazla kalem iadesinde toplamı hesaplar', () => {
    const amount = calculateReturnRefundAmount(
      { items: orderItems, totalAmount: 350 },
      [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
      'return',
      { amount: 350, refundedAmount: 0 }
    );

    expect(amount).toBe(350);
  });

  it('kalan iade edilebilir tutarı aşarsa hata fırlatır', () => {
    expect(() =>
      calculateReturnRefundAmount(
        { items: orderItems, totalAmount: 350 },
        [{ productId: 'p1', quantity: 2 }],
        'return',
        { amount: 350, refundedAmount: 300 }
      )
    ).toThrow(CommerceError);
  });

  it('iade edilebilir tutar kalmadıysa hata fırlatır', () => {
    expect(() =>
      calculateReturnRefundAmount(
        { items: orderItems, totalAmount: 350 },
        [{ productId: 'p2', quantity: 1 }],
        'return',
        { amount: 350, refundedAmount: 350 }
      )
    ).toThrow(CommerceError);
  });
});

describe('isFullOrderReturn', () => {
  it('tüm kalemler tam adetle iade edildiyse true döner', () => {
    expect(
      isFullOrderReturn(orderItems, [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ])
    ).toBe(true);
  });

  it('kısmi kalem iadesinde false döner', () => {
    expect(isFullOrderReturn(orderItems, [{ productId: 'p1', quantity: 1 }])).toBe(false);
  });
});
