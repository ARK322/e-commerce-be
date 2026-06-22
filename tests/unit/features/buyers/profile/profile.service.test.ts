import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUserFindById = vi.fn();
const mockBuyerFindByIdLean = vi.fn();
const mockSellerFindByIdLean = vi.fn();
const mockUpdateBuyerProfile = vi.fn();
const mockUpdateSellerProfile = vi.fn();

vi.mock('@/repositories/auth/user.repository', () => ({
  findUserById: (...args: unknown[]) => mockUserFindById(...args),
}));

vi.mock('@/repositories/buyers/buyer.repository', () => ({
  findBuyerByIdLean: (...args: unknown[]) => mockBuyerFindByIdLean(...args),
}));

vi.mock('@/repositories/sellers/seller.repository', () => ({
  findSellerByIdLean: (...args: unknown[]) => mockSellerFindByIdLean(...args),
}));

vi.mock('@/domain/auth/profile/buyer', () => ({
  updateBuyerProfile: (...args: unknown[]) => mockUpdateBuyerProfile(...args),
}));

vi.mock('@/domain/auth/profile/seller', () => ({
  updateSellerProfile: (...args: unknown[]) => mockUpdateSellerProfile(...args),
}));

vi.mock('@/domain/auth/responses/user.response', () => ({
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

import { getProfile, updateProfile } from '@/features/buyers/profile/profile.service';

const userId = '550e8400-e29b-41d4-a716-446655440000';

describe('getProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin 403 alır', async () => {
    mockUserFindById.mockResolvedValue({
      email: 'admin@example.com',
      role: 'admin',
      isActive: true,
      isEmailVerified: true,
    });

    await expect(getProfile({ userId, role: 'admin' })).rejects.toMatchObject({
      statusCode: 403,
      message: 'Bu endpoint buyer ve seller içindir',
    });
  });

  it('buyer profilini döner', async () => {
    mockUserFindById.mockResolvedValue({
      _id: userId,
      email: 'buyer@example.com',
      role: 'buyer',
      isActive: false,
      isEmailVerified: true,
    });
    mockBuyerFindByIdLean.mockResolvedValue({ _id: userId, firstName: 'Ali' });

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
    mockUserFindById.mockResolvedValue({
      email: 'seller@example.com',
      role: 'seller',
      isEmailVerified: true,
    });
    mockSellerFindByIdLean.mockResolvedValue({
      _id: userId,
      approvalStatus: 'pending',
      rejectionReason: null,
    });

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
