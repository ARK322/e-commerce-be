import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRefundIyzico = vi.fn();
const mockSavePayment = vi.fn();

vi.mock('@/infrastructure/iyzico/refund-payment', () => ({
  refundIyzicoPayment: (...args: unknown[]) => mockRefundIyzico(...args),
}));

vi.mock('@/domain/payment/payment-audit', () => ({
  logPaymentTransition: vi.fn(),
}));

vi.mock('@/repositories/buyers/payment.repository', () => ({
  savePaymentDocument: (...args: unknown[]) => mockSavePayment(...args),
  updatePaymentStatusByOrderId: vi.fn(),
}));

import { refundCapturedIyzicoPayment } from '@/domain/payment/refund-captured-payment';

const buildPayment = (overrides: Record<string, unknown> = {}) => ({
  _id: 'pay-1',
  orderId: 'order-1',
  amount: 300,
  refundedAmount: 0,
  status: 'completed',
  save: vi.fn(),
  ...overrides,
});

describe('refundCapturedIyzicoPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSavePayment.mockResolvedValue(undefined);
  });

  it('tam iade sonrası payment status refunded olur', async () => {
    mockRefundIyzico.mockResolvedValue(true);
    const payment = buildPayment();

    const result = await refundCapturedIyzicoPayment(payment, 'iyzico-1', 'full_refund');

    expect(result).toBe(true);
    expect(payment.refundedAmount).toBe(300);
    expect(payment.status).toBe('refunded');
  });

  it('kısmi iade sonrası payment status completed kalır', async () => {
    mockRefundIyzico.mockResolvedValue(true);
    const payment = buildPayment();

    const result = await refundCapturedIyzicoPayment(
      payment,
      'iyzico-1',
      'partial_refund',
      100
    );

    expect(result).toBe(true);
    expect(payment.refundedAmount).toBe(100);
    expect(payment.status).toBe('completed');
  });

  it('kısmi iade başarısız olursa ödeme completed kalır', async () => {
    mockRefundIyzico.mockResolvedValue(false);
    const payment = buildPayment({ refundedAmount: 50 });

    const result = await refundCapturedIyzicoPayment(
      payment,
      'iyzico-1',
      'partial_refund',
      100
    );

    expect(result).toBe(false);
    expect(payment.status).toBe('completed');
    expect(payment.refundedAmount).toBe(50);
  });

  it('geçersiz iade tutarında false döner', async () => {
    const payment = buildPayment();

    const result = await refundCapturedIyzicoPayment(
      payment,
      'iyzico-1',
      'invalid_refund',
      500
    );

    expect(result).toBe(false);
    expect(mockRefundIyzico).not.toHaveBeenCalled();
  });
});
