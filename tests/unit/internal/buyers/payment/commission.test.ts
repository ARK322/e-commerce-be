import { afterEach, describe, expect, it, vi } from 'vitest';
import { calcItemSplit, getPlatformCommissionRate } from '@/domains/payments/application/payment/commission';

describe('getPlatformCommissionRate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('env yoksa hata fırlatır', () => {
    vi.stubEnv('PLATFORM_COMMISSION_RATE', '');

    expect(() => getPlatformCommissionRate()).toThrow(/PLATFORM_COMMISSION_RATE tanımlı olmalı/);
  });

  it('env değerini okur', () => {
    vi.stubEnv('PLATFORM_COMMISSION_RATE', '0.08');

    expect(getPlatformCommissionRate()).toBe(0.08);
  });
});

describe('calcItemSplit', () => {
  it('komisyonu düşerek satıcı payını hesaplar', () => {
    expect(calcItemSplit(1000, 0.1)).toEqual({
      subtotal: 1000,
      commissionAmount: 100,
      sellerShare: 900,
    });
  });

  it('küsuratlı tutarlarda iki haneye yuvarlar', () => {
    expect(calcItemSplit(999.99, 0.1)).toEqual({
      subtotal: 999.99,
      commissionAmount: 100,
      sellerShare: 899.99,
    });
  });
});
