import { describe, expect, it } from 'vitest';
import {
  buildSellerDocumentObjectPath,
  isSellerDocumentType,
  resolveAcceptedMimeType,
  resolveDocumentExtension,
  SELLER_DOCUMENT_FIELD_MAP,
} from '@/domains/identity/application/profile/seller-document-types';

describe('seller-document-types', () => {
  it('geçerli docType tanır', () => {
    expect(isSellerDocumentType('taxCertificate')).toBe(true);
    expect(isSellerDocumentType('invalid')).toBe(false);
  });

  it('docType alan eşlemesini döner', () => {
    expect(SELLER_DOCUMENT_FIELD_MAP.taxCertificate).toBe('taxCertificateUrl');
  });

  it('object path üretir', () => {
    expect(buildSellerDocumentObjectPath('user-1', 'companyLogo', 'png')).toBe(
      'user-1/companyLogo.png'
    );
  });

  it('mime tipine göre uzantı çözümler', () => {
    expect(resolveDocumentExtension('image/png', 'companyLogo')).toBe('png');
    expect(resolveDocumentExtension('image/jpeg', 'companyLogo')).toBe('jpg');
    expect(resolveDocumentExtension('application/pdf', 'taxCertificate')).toBe('pdf');
  });

  it('PDF buffer octet-stream için kabul eder', () => {
    const pdfHeader = Buffer.from('%PDF-1.4');
    expect(resolveAcceptedMimeType('taxCertificate', 'application/octet-stream', pdfHeader)).toBe(
      'application/pdf'
    );
  });
});
