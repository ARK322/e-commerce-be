import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindOne = vi.fn();
const mockFindById = vi.fn();
const mockFindOneAndUpdate = vi.fn();

const chainFindById = (value: unknown) => ({
  select: vi.fn().mockResolvedValue(value),
});

vi.mock('../../../../../db', () => ({
  Admin: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
  },
  User: {
    findById: (...args: unknown[]) => mockFindById(...args),
  },
}));

import { updateAdminProfile } from './profile.service';

const ownerId = '507f1f77bcf86cd799439011';
const helperId = '507f1f77bcf86cd799439012';

const helperAdmin = {
  userId: helperId,
  adminRole: 'helper',
  firstName: null,
  lastName: null,
  phone: null,
};

const helperUser = {
  email: 'helper@example.com',
  role: 'admin',
  isEmailVerified: true,
  createdAt: new Date(),
};

describe('updateAdminProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOne.mockResolvedValue(helperAdmin);
    mockFindById.mockReturnValue(chainFindById(helperUser));
    mockFindOneAndUpdate.mockResolvedValue({
      ...helperAdmin,
      firstName: 'Ali',
      lastName: 'Veli',
    });
  });

  it('helper kendi profilini güncelleyebilir', async () => {
    const result = await updateAdminProfile('helper', helperId, helperId, {
      firstName: 'Ali',
      lastName: 'Veli',
    });

    expect(result.profile.firstName).toBe('Ali');
    expect(mockFindOneAndUpdate).toHaveBeenCalled();
  });

  it('owner başka admin profilini güncelleyebilir', async () => {
    await updateAdminProfile('owner', ownerId, helperId, { firstName: 'Ali' });

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: helperId },
      { $set: { firstName: 'Ali' } },
      { returnDocument: 'after' }
    );
  });

  it('helper başka admin profilini güncelleyemez', async () => {
    await expect(
      updateAdminProfile('helper', helperId, ownerId, { firstName: 'Ali' })
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });
});
