import { describe, expect, it } from 'vitest';
import { isBuyerProfileComplete, isSellerProfileComplete } from './profile-completion';

describe('isBuyerProfileComplete', () => {
  it('eksik alıcı profilini reddeder', () => {
    expect(isBuyerProfileComplete({ firstName: 'Ali' })).toBe(false);
  });

  it('tam alıcı profilini kabul eder', () => {
    expect(
      isBuyerProfileComplete({
        firstName: 'Ali',
        lastName: 'Veli',
        phone: '05551234567',
        country: 'TR',
        city: 'Istanbul',
        nationalId: '12345678901',
        deliveryAddress: 'Adres 1',
        billingSameAsDelivery: true,
        billingAddress: 'Adres 1',
      })
    ).toBe(true);
  });
});

describe('isSellerProfileComplete', () => {
  it('eksik satıcı profilini reddeder', () => {
    expect(isSellerProfileComplete({ sellerType: 'bireysel' })).toBe(false);
  });
});
