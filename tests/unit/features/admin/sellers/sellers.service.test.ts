import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@/internal/auth/access/admin/permission-keys';
import type { AdminAccessContext } from '@/internal/auth/queries/admin-context';

const mockUserFindById = vi.fn();
const mockSellerFindById = vi.fn();
const mockSellerFindOneAndUpdate = vi.fn();
const mockSendApproved = vi.fn();
const mockSendRejected = vi.fn();

const chainFindById = (value: unknown) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(value),
  }),
});

vi.mock('@/integrations/mongo', () => ({
  User: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
  Seller: {
    findById: (...args: unknown[]) => mockSellerFindById(...args),
    findOneAndUpdate: (...args: unknown[]) => mockSellerFindOneAndUpdate(...args),
  },
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

const mockPendingSeller = (save: ReturnType<typeof vi.fn>) => ({
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
  save,
});

describe('sellers.service bildirimleri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindById.mockReturnValue(
      chainFindById({
        role: 'seller',
        email: 'seller@example.com',
        isEmailVerified: true,
      })
    );
    mockSendApproved.mockResolvedValue(undefined);
    mockSendRejected.mockResolvedValue(undefined);
    mockSellerFindOneAndUpdate.mockResolvedValue({
      _id: userId,
      approvalStatus: 'approved',
      companyName: 'Test A.Ş.',
    });
  });

  it('onay sonrası satıcıya mail gönderir', async () => {
    const save = vi.fn();
    mockSellerFindById.mockResolvedValue(mockPendingSeller(save));

    await approveSeller(ownerCtx, userId);

    expect(mockSellerFindOneAndUpdate).toHaveBeenCalled();
    expect(createIyzicoSubMerchant).toHaveBeenCalled();
    expect(mockSendApproved).toHaveBeenCalledWith('seller@example.com', 'Test A.Ş.');
  });

  it('red sonrası sebeple birlikte mail gönderir', async () => {
    const save = vi.fn();
    mockSellerFindById.mockResolvedValue(mockPendingSeller(save));

    await rejectSeller(ownerCtx, userId, 'Vergi levhası okunamıyor');

    expect(save).toHaveBeenCalled();
    expect(mockSendRejected).toHaveBeenCalledWith(
      'seller@example.com',
      'Vergi levhası okunamıyor',
      'Test A.Ş.'
    );
  });

  it('mail gönderilemese bile onay işlemi tamamlanır', async () => {
    const save = vi.fn();
    mockSellerFindById.mockResolvedValue(mockPendingSeller(save));
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
    mockUserFindById.mockReturnValue(
      chainFindById({
        role: 'seller',
        email: 'seller@example.com',
      })
    );
  });

  it('DBden onaylı ama keysiz satıcı için Iyzico kaydı oluşturur', async () => {
    const save = vi.fn();
    mockSellerFindById.mockResolvedValue({
      ...mockPendingSeller(save),
      approvalStatus: 'approved',
      save,
    });

    const result = await syncSellerIyzicoSubMerchant(ownerCtx, userId);

    expect(createIyzicoSubMerchant).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
    expect(result).toMatchObject({
      created: true,
      iyzicoSubMerchantRegistered: true,
    });
  });

  it('key zaten varsa yeniden oluşturmaz', async () => {
    const save = vi.fn();
    mockSellerFindById.mockResolvedValue({
      ...mockPendingSeller(save),
      approvalStatus: 'approved',
      iyzicoSubMerchantKey: 'existing-key',
      save,
    });

    const result = await syncSellerIyzicoSubMerchant(ownerCtx, userId);

    expect(createIyzicoSubMerchant).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      created: false,
      iyzicoSubMerchantRegistered: true,
    });
  });

  it('onaylı olmayan satıcı için 400 fırlatır', async () => {
    mockSellerFindById.mockResolvedValue(mockPendingSeller(vi.fn()));

    await expect(syncSellerIyzicoSubMerchant(ownerCtx, userId)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
