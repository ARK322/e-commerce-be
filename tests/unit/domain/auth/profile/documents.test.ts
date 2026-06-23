import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpload = vi.fn();
const mockDelete = vi.fn();
const mockUpdateSellerProfile = vi.fn();
const mockFindSellerByIdLean = vi.fn();
const mockUpdateSellerById = vi.fn();
const mockGetSellerContext = vi.fn();

vi.mock('@/infrastructure/supabase/supabase', () => ({
  uploadToSellerStorage: (...args: unknown[]) => mockUpload(...args),
  deleteFromSellerStorage: (...args: unknown[]) => mockDelete(...args),
  getSupabaseConfig: () => ({ bucket: 'seller-documents' }),
  parseStorageObjectPathFromPublicUrl: (url: string, bucket: string) => {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.indexOf(marker);
    return index === -1 ? null : url.slice(index + marker.length);
  },
}));

vi.mock('@/repositories/sellers/seller.repository', () => ({
  findSellerByIdLean: (...args: unknown[]) => mockFindSellerByIdLean(...args),
  updateSellerById: (...args: unknown[]) => mockUpdateSellerById(...args),
}));

vi.mock('@/domain/auth/queries/seller-context', () => ({
  getSellerContext: (...args: unknown[]) => mockGetSellerContext(...args),
}));

vi.mock('@/domain/auth/profile/seller', () => ({
  updateSellerProfile: (...args: unknown[]) => mockUpdateSellerProfile(...args),
}));

import { uploadSellerDocument } from '@/domain/auth/profile/documents';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const pdfBuffer = Buffer.from('%PDF-1.4 test');

describe('uploadSellerDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSellerContext.mockResolvedValue({
      userId,
      companyId: userId,
      companyName: 'Test',
      sellerType: 'kurumsal',
      approvalStatus: 'draft',
      roleId: '770e8400-e29b-41d4-a716-446655440000',
      roleSlug: 'owner',
      roleName: 'Owner',
      permissions: new Set(),
      isOwner: true,
      teamManagementEnabled: true,
      member: { firstName: null, lastName: null, phone: null },
    });
    mockFindSellerByIdLean.mockResolvedValue({ taxCertificateUrl: null });
    mockUpload.mockResolvedValue(
      `https://xxx.supabase.co/storage/v1/object/public/seller-documents/${userId}/taxCertificate.pdf`
    );
    mockUpdateSellerProfile.mockResolvedValue({
      approvalStatus: 'draft',
      profile: { taxCertificateUrl: 'https://xxx.supabase.co/...' },
    });
  });

  it('buyer yükleyemez', async () => {
    await expect(
      uploadSellerDocument(
        { userId, role: 'buyer' },
        { docType: 'taxCertificate', mimeType: 'application/pdf', buffer: pdfBuffer }
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Bu endpoint sadece satıcılar içindir',
    });
  });

  it('vergi levhası yükler ve profile yazar', async () => {
    const result = await uploadSellerDocument(
      { userId, role: 'seller' },
      { docType: 'taxCertificate', mimeType: 'application/pdf', buffer: pdfBuffer }
    );

    expect(mockUpload).toHaveBeenCalledWith(
      `${userId}/taxCertificate.pdf`,
      pdfBuffer,
      'application/pdf'
    );
    expect(mockUpdateSellerProfile).toHaveBeenCalledWith(userId, {
      taxCertificateUrl: `https://xxx.supabase.co/storage/v1/object/public/seller-documents/${userId}/taxCertificate.pdf`,
    });
    expect(result.field).toBe('taxCertificateUrl');
    expect(result.url).toContain('supabase.co');
  });

  it('aynı belge tipinde sabit path kullanır (üzerine yazar)', async () => {
    mockFindSellerByIdLean.mockResolvedValue({
      companyLogoUrl: `https://xxx.supabase.co/storage/v1/object/public/seller-documents/${userId}/companyLogo.png`,
    });

    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

    await uploadSellerDocument(
      { userId, role: 'seller' },
      { docType: 'companyLogo', mimeType: 'image/jpeg', buffer: jpegBuffer }
    );

    expect(mockDelete).toHaveBeenCalledWith(`${userId}/companyLogo.png`);
    expect(mockUpload).toHaveBeenCalledWith(
      `${userId}/companyLogo.jpg`,
      expect.any(Buffer),
      'image/jpeg'
    );
  });

  it('pdf olmayan vergi levhasını reddeder', async () => {
    await expect(
      uploadSellerDocument(
        { userId, role: 'seller' },
        { docType: 'taxCertificate', mimeType: 'image/png', buffer: pdfBuffer }
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Geçersiz dosya türü',
    });
  });

  it('geçersiz docType reddedilir', async () => {
    await expect(
      uploadSellerDocument(
        { userId, role: 'seller' },
        { docType: 'invalid', mimeType: 'application/pdf', buffer: pdfBuffer }
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Geçersiz belge tipi',
    });
  });
});
