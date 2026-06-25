import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListExpiredUnverifiedUsersLean = vi.fn();
const mockDeleteUnverifiedUser = vi.fn();

vi.mock('@/repositories/auth/user.repository', () => ({
  listExpiredUnverifiedUsersLean: (...args: unknown[]) => mockListExpiredUnverifiedUsersLean(...args),
}));

vi.mock('@/domain/auth/register/unverified-user', () => ({
  deleteUnverifiedUser: (...args: unknown[]) => mockDeleteUnverifiedUser(...args),
}));

import { expireUnverifiedUsers } from '@/domain/auth/register/expire-unverified-users';

describe('expireUnverifiedUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListExpiredUnverifiedUsersLean.mockResolvedValue([{ _id: 'u1' }, { _id: 'u2' }]);
    mockDeleteUnverifiedUser.mockResolvedValue(undefined);
  });

  it('süresi dolan doğrulanmamış kullanıcıları siler', async () => {
    const count = await expireUnverifiedUsers();

    expect(count).toBe(2);
    expect(mockDeleteUnverifiedUser).toHaveBeenCalledTimes(2);
    expect(mockListExpiredUnverifiedUsersLean).toHaveBeenCalledWith(expect.any(Date));
  });

  it('silme hatasında diğer kullanıcıları işlemeye devam eder', async () => {
    mockDeleteUnverifiedUser
      .mockRejectedValueOnce(new Error('db error'))
      .mockResolvedValueOnce(undefined);

    const count = await expireUnverifiedUsers();

    expect(count).toBe(1);
  });
});
