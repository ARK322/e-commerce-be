import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUserFindById = vi.fn();
const mockBuyerFindById = vi.fn();
const mockSellerFindById = vi.fn();
const mockUpdateBuyerProfile = vi.fn();
const mockUpdateSellerProfile = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  User: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
  Buyer: {
    findById: (...args: unknown[]) => mockBuyerFindById(...args),
  },
  Seller: {
    findById: (...args: unknown[]) => mockSellerFindById(...args),
  },
}));

vi.mock('@/internal/auth/profile/buyer', () => ({
  updateBuyerProfile: (...args: unknown[]) => mockUpdateBuyerProfile(...args),
}));

vi.mock('@/internal/auth/profile/seller', () => ({
  updateSellerProfile: (...args: unknown[]) => mockUpdateSellerProfile(...args),
}));

vi.mock('@/internal/auth/responses/user.response', () => ({
  buildAuthUserFields: vi.fn(async (user: { _id: unknown; role: string; isActive?: boolean }) => {
    if (user.role === 'buyer') {
      return {
        userId: user._id,
        role: user.role,
        isEmailVerified: true,
        isActive: user.isActive ?? false,
      };
    }

    return {
      userId: user._id,
      role: user.role,
      isEmailVerified: true,
      approvalStatus: 'pending',
    };
  }),
}));

import { getProfile, updateProfile } from '@/features/auth/account/profile/profile.service';

const userId = '550e8400-e29b-41d4-a716-446655440000';

const chainSelect = (value: unknown) => ({
  select: vi.fn().mockResolvedValue(value),
});

const chainLean = (value: unknown) => ({
  lean: vi.fn().mockResolvedValue(value),
});

describe('getProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin 403 alır', async () => {
    mockUserFindById.mockReturnValue(
      chainSelect({
        email: 'admin@example.com',
        role: 'admin',
        isActive: true,
        isEmailVerified: true,
      })
    );

    await expect(getProfile({ userId, role: 'admin' })).rejects.toMatchObject({
      statusCode: 403,
      message: 'Bu endpoint buyer ve seller içindir',
    });
  });

  it('buyer profilini döner', async () => {
    mockUserFindById.mockReturnValue(
      chainSelect({
        _id: userId,
        email: 'buyer@example.com',
        role: 'buyer',
        isActive: false,
        isEmailVerified: true,
      })
    );
    mockBuyerFindById.mockReturnValue(chainLean({ _id: userId, firstName: 'Ali' }));

    const result = await getProfile({ userId, role: 'buyer' });

    expect(result).toMatchObject({
      email: 'buyer@example.com',
      userId,
      role: 'buyer',
      isActive: false,
      profile: { firstName: 'Ali' },
    });
  });

  it('seller profilinde approvalStatus döner', async () => {
    mockUserFindById.mockReturnValue(
      chainSelect({
        email: 'seller@example.com',
        role: 'seller',
        isEmailVerified: true,
      })
    );
    mockSellerFindById.mockReturnValue(
      chainLean({
        _id: userId,
        approvalStatus: 'pending',
        rejectionReason: null,
      })
    );

    const result = await getProfile({ userId, role: 'seller' });

    expect(result).toMatchObject({ approvalStatus: 'pending' });
  });
});

describe('updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buyer güncellemesini buyer service\'e yönlendirir', async () => {
    mockUpdateBuyerProfile.mockResolvedValue({ profile: {}, isActive: true });

    await updateProfile({ userId, role: 'buyer' }, { firstName: 'Ali' });

    expect(mockUpdateBuyerProfile).toHaveBeenCalledWith(userId, { firstName: 'Ali' });
  });

  it('admin güncellemesinde 403 döner', async () => {
    await expect(
      updateProfile({ userId, role: 'admin' }, { firstName: 'Ali' })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Bu endpoint buyer ve seller içindir',
    });
  });
});
