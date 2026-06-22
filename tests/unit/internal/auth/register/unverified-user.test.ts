import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUserById = vi.fn();
const mockDeleteUserById = vi.fn();
const mockDeleteAuthOtpsForUser = vi.fn();
const mockDeleteBuyerById = vi.fn();
const mockDeleteSellerById = vi.fn();
const mockDeleteSellerMemberById = vi.fn();
const mockDeleteSellerRolesBySellerId = vi.fn();

vi.mock('@/domains/identity/infrastructure/repositories/auth/user.repository', () => ({
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
  deleteUserById: (...args: unknown[]) => mockDeleteUserById(...args),
}));

vi.mock('@/domains/identity/infrastructure/repositories/buyer.repository', () => ({
  deleteBuyerById: (...args: unknown[]) => mockDeleteBuyerById(...args),
}));

vi.mock('@/domains/identity/infrastructure/repositories/seller-member.repository', () => ({
  deleteSellerMemberById: (...args: unknown[]) => mockDeleteSellerMemberById(...args),
}));

vi.mock('@/domains/identity/infrastructure/repositories/seller-role.repository', () => ({
  deleteSellerRolesBySellerId: (...args: unknown[]) => mockDeleteSellerRolesBySellerId(...args),
}));

vi.mock('@/domains/identity/infrastructure/repositories/seller.repository', () => ({
  deleteSellerById: (...args: unknown[]) => mockDeleteSellerById(...args),
}));

vi.mock('@/domains/identity/application/otp/otp', async () => {
  const actual = await vi.importActual<typeof import('@/domains/identity/application/otp/otp')>(
    '@/domains/identity/application/otp/otp'
  );
  return {
    ...actual,
    deleteAuthOtpsForUser: (...args: unknown[]) => mockDeleteAuthOtpsForUser(...args),
  };
});

import { deleteUnverifiedUser, getVerificationExpiresAt } from '@/domains/identity/application/register/unverified-user';

const userId = '550e8400-e29b-41d4-a716-446655440000';

describe('unverified-user helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteAuthOtpsForUser.mockResolvedValue(undefined);
    mockDeleteBuyerById.mockResolvedValue(undefined);
    mockDeleteSellerById.mockResolvedValue(undefined);
    mockDeleteSellerMemberById.mockResolvedValue(undefined);
    mockDeleteSellerRolesBySellerId.mockResolvedValue(undefined);
    mockDeleteUserById.mockResolvedValue(undefined);
  });

  it('getVerificationExpiresAt gelecekte bir tarih döner', () => {
    const expiresAt = getVerificationExpiresAt();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('doğrulanmış kullanıcıyı silmez', async () => {
    mockFindUserById.mockResolvedValue({ isEmailVerified: true });

    await deleteUnverifiedUser(userId);

    expect(mockDeleteUserById).not.toHaveBeenCalled();
  });

  it('doğrulanmamış kullanıcıyı ve ilişkili kayıtları siler', async () => {
    mockFindUserById.mockResolvedValue({ isEmailVerified: false });

    await deleteUnverifiedUser(userId);

    expect(mockDeleteAuthOtpsForUser).toHaveBeenCalledWith(userId);
    expect(mockDeleteBuyerById).toHaveBeenCalledWith(userId);
    expect(mockDeleteSellerMemberById).toHaveBeenCalledWith(userId);
    expect(mockDeleteSellerRolesBySellerId).toHaveBeenCalledWith(userId);
    expect(mockDeleteSellerById).toHaveBeenCalledWith(userId);
    expect(mockDeleteUserById).toHaveBeenCalledWith(userId);
  });

  it('kullanıcı yoksa işlem yapmaz', async () => {
    mockFindUserById.mockResolvedValue(null);

    await deleteUnverifiedUser(userId);

    expect(mockDeleteUserById).not.toHaveBeenCalled();
  });
});
