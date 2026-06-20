import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@/internal/auth/access/admin/permission-keys';
import type { AdminAccessContext } from '@/internal/auth/queries/admin-context';

const mockUserFindByIdLean = vi.fn();
const mockSellerFindById = vi.fn();
const mockApproveSellerIfPending = vi.fn();
const mockSaveSellerDocument = vi.fn();
const mockSendApproved = vi.fn();
const mockSendRejected = vi.fn();

vi.mock('@/repositories/auth/user.repository', () => ({
  findUserByIdLean: (...args: unknown[]) => mockUserFindByIdLean(...args),
}));

vi.mock('@/repositories/sellers/seller.repository', () => ({
  findSellerById: (...args: unknown[]) => mockSellerFindById(...args),
  approveSellerIfPending: (...args: unknown[]) => mockApproveSellerIfPending(...args),
  saveSellerDocument: (...args: unknown[]) => mockSaveSellerDocument(...args),
}));

vi.mock('@/integrations/iyzico/create-submerchant', () => ({
  createIyzicoSubMerchant: vi.fn().mockResolvedValue('sandbox-sub-merchant-key'),
}));

vi.mock('@/internal/auth/admin/mail/send-seller-notifications', () => ({
  sendSellerApprovedEmail: (...args: unknown[]) => mockSendApproved(...args),
  sendSellerRejectedEmail: (...args: unknown[]) => mockSendRejected(...args),
}));

import {
  approveSeller,
  rejectSeller,
  syncSellerIyzicoSubMerchant,
} from '@/features/admin/sellers/sellers.service';
import { createIyzicoSubMerchant } from '@/integrations/iyzico/create-submerchant';

const userId = '550e8400-e29b-41d4-a716-446655440000';

const ownerCtx: AdminAccessContext = {
  userId: '660e8400-e29b-41d4-a716-446655440000',
  roleId: '770e8400-e29b-41d4-a716-446655440000',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(Object.values(PERMISSIONS)),
  isOwner: true,
};

const limitedCtx: AdminAccessContext = {
  userId: '660e8400-e29b-41d4-a716-446655440001',
  roleId: '770e8400-e29b-41d4-a716-446655440001',
  roleSlug: 'limited',
  roleName: 'Limited',
  permissions: new Set([PERMISSIONS.SELLERS_READ]),
  isOwner: false,
};

const completeSellerProfile = {
  sellerType: 'kurumsal' as const,
  companyName: 'Test A.Ş.',
  taxNumber: '1234567890',
  taxOffice: 'Kadıköy',
  country: 'Türkiye',
  city: 'İstanbul',
  district: 'Kadıköy',
  companyAddress: 'Test adres',
  taxCertificateUrl: 'https://cdn.example.com/tax.pdf',
  signatureCircularUrl: 'https://cdn.example.com/sig.pdf',
  bankName: 'Test Bank',
  iban: 'TR330006100519786457841326',
  accountHolderName: 'Test A.Ş.',
  companyLogoUrl: 'https://cdn.example.com/logo.png',
  companyDescription: 'Test şirket açıklaması en az on karakter',
  authorizedFirstName: 'Ali',
  authorizedLastName: 'Veli',
  authorizedPhone: '05551234567',
  companyPhone: '05551234567',
  companyType: 'ltd' as const,
};

const mockPendingSeller = () => ({
  _id: userId,
  approvalStatus: 'pending',
  rejectionReason: null,
  iyzicoSubMerchantKey: null,
  phone: '05551234567',
  ...completeSellerProfile,
  toObject: () => ({
    _id: userId,
    approvalStatus: 'pending',
    ...completeSellerProfile,
  }),
});

describe('sellers.service bildirimleri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindByIdLean.mockResolvedValue({
      role: 'seller',
      email: 'seller@example.com',
      isEmailVerified: true,
    });
    mockSendApproved.mockResolvedValue(undefined);
    mockSendRejected.mockResolvedValue(undefined);
    mockApproveSellerIfPending.mockResolvedValue({
      _id: userId,
      approvalStatus: 'approved',
      companyName: 'Test A.Ş.',
    });
    mockSaveSellerDocument.mockResolvedValue(undefined);
  });

  it('onay sonrası satıcıya mail gönderir', async () => {
    mockSellerFindById.mockResolvedValue(mockPendingSeller());

    await approveSeller(ownerCtx, userId);

    expect(mockApproveSellerIfPending).toHaveBeenCalled();
    expect(createIyzicoSubMerchant).toHaveBeenCalled();
    expect(mockSendApproved).toHaveBeenCalledWith('seller@example.com', 'Test A.Ş.');
  });

  it('red sonrası sebeple birlikte mail gönderir', async () => {
    mockSellerFindById.mockResolvedValue(mockPendingSeller());

    await rejectSeller(ownerCtx, userId, 'Vergi levhası okunamıyor');

    expect(mockSaveSellerDocument).toHaveBeenCalled();
    expect(mockSendRejected).toHaveBeenCalledWith(
      'seller@example.com',
      'Vergi levhası okunamıyor',
      'Test A.Ş.'
    );
  });

  it('mail gönderilemese bile onay işlemi tamamlanır', async () => {
    mockSellerFindById.mockResolvedValue(mockPendingSeller());
    mockSendApproved.mockRejectedValue(new Error('Resend hatası'));

    const result = await approveSeller(ownerCtx, userId);

    expect(result.approvalStatus).toBe('approved');
  });

  it('sellers.approve yetkisi olmadan satıcı onaylanamaz', async () => {
    await expect(approveSeller(limitedCtx, userId)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Satıcı onaylama yetkin yok',
    });
  });

  it('sellers.approve yetkisi olmadan satıcı reddedilemez', async () => {
    await expect(rejectSeller(limitedCtx, userId, 'Sebep')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Satıcı onaylama yetkin yok',
    });
  });
});

describe('syncSellerIyzicoSubMerchant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindByIdLean.mockResolvedValue({
      role: 'seller',
      email: 'seller@example.com',
    });
    mockSaveSellerDocument.mockResolvedValue(undefined);
  });

  it('DBden onaylı ama keysiz satıcı için Iyzico kaydı oluşturur', async () => {
    mockSellerFindById.mockResolvedValue({
      ...mockPendingSeller(),
      approvalStatus: 'approved',
    });

    const result = await syncSellerIyzicoSubMerchant(ownerCtx, userId);

    expect(createIyzicoSubMerchant).toHaveBeenCalled();
    expect(mockSaveSellerDocument).toHaveBeenCalled();
    expect(result).toMatchObject({
      created: true,
      iyzicoSubMerchantRegistered: true,
    });
  });

  it('key zaten varsa yeniden oluşturmaz', async () => {
    mockSellerFindById.mockResolvedValue({
      ...mockPendingSeller(),
      approvalStatus: 'approved',
      iyzicoSubMerchantKey: 'existing-key',
    });

    const result = await syncSellerIyzicoSubMerchant(ownerCtx, userId);

    expect(createIyzicoSubMerchant).not.toHaveBeenCalled();
    expect(mockSaveSellerDocument).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      created: false,
      iyzicoSubMerchantRegistered: true,
    });
  });

  it('onaylı olmayan satıcı için 400 fırlatır', async () => {
    mockSellerFindById.mockResolvedValue(mockPendingSeller());

    await expect(syncSellerIyzicoSubMerchant(ownerCtx, userId)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
