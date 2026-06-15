import { describe, expect, it } from 'vitest';
import { isBuyerProfileComplete, isSellerProfileComplete } from '@/features/auth/core/profile/profile-completion';

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

const sellerCommon = {
  companyName: 'Test Ticaret',
  taxNumber: '1234567890',
  taxOffice: 'Kadıköy',
  country: 'TR',
  city: 'Istanbul',
  district: 'Kadıköy',
  companyAddress: 'Adres satırı',
  taxCertificateUrl: 'https://example.com/tax.pdf',
  bankName: 'Ziraat',
  iban: 'TR330006100519786457841326',
  accountHolderName: 'Test Ticaret',
  companyLogoUrl: 'https://example.com/logo.png',
  companyDescription: 'Test şirket tanıtım metni yeterince uzun.',
};

describe('isSellerProfileComplete', () => {
  it('eksik satıcı profilini reddeder', () => {
    expect(isSellerProfileComplete({ sellerType: 'bireysel' })).toBe(false);
  });

  it('tam bireysel (şahıs şirketi) profilini kabul eder', () => {
    expect(
      isSellerProfileComplete({
        sellerType: 'bireysel',
        ...sellerCommon,
        authorizedFirstName: 'Ali',
        authorizedLastName: 'Veli',
        authorizedPhone: '05551234567',
        companyPhone: '05559876543',
      })
    ).toBe(true);
  });

  it('tam kurumsal (Ltd/A.Ş.) profilini kabul eder', () => {
    expect(
      isSellerProfileComplete({
        sellerType: 'kurumsal',
        companyType: 'ltd',
        ...sellerCommon,
        authorizedFirstName: 'Ayşe',
        authorizedLastName: 'Yılmaz',
        authorizedPhone: '05551234567',
        companyPhone: '02121234567',
        signatureCircularUrl: 'https://example.com/signature.pdf',
      })
    ).toBe(true);
  });

  it('kurumsal profilde geçersiz companyType reddedilir', () => {
    expect(
      isSellerProfileComplete({
        sellerType: 'kurumsal',
        companyType: 'diger',
        ...sellerCommon,
        authorizedFirstName: 'Ayşe',
        authorizedLastName: 'Yılmaz',
        authorizedPhone: '05551234567',
        companyPhone: '02121234567',
        signatureCircularUrl: 'https://example.com/signature.pdf',
      })
    ).toBe(false);
  });
});
