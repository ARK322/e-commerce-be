import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUserById = vi.fn();
const mockUpdateUserById = vi.fn();
const mockComparePassword = vi.fn();
const mockHashPassword = vi.fn();

vi.mock('@/domains/identity/infrastructure/repositories/auth/user.repository', () => ({
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
  updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
}));

vi.mock('@/shared/security', () => ({
  comparePassword: (...args: unknown[]) => mockComparePassword(...args),
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
}));

const mockRevokeAllSessions = vi.fn();

vi.mock('@/domains/identity/application/tokens/invalidate-all', () => ({
  revokeAllSessions: (...args: unknown[]) => mockRevokeAllSessions(...args),
}));

import { changePassword } from '@/api/auth/change-password/change-password.service';

describe('changePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUserById.mockResolvedValue({ _id: '550e8400-e29b-41d4-a716-446655440000', password: 'hash' });
    mockComparePassword.mockResolvedValue(true);
    mockHashPassword.mockResolvedValue('new-hash');
    mockUpdateUserById.mockResolvedValue({});
    mockRevokeAllSessions.mockResolvedValue(undefined);
  });

  it('şifreyi günceller ve passwordChangedAt yazar', async () => {
    await changePassword(
      { userId: '550e8400-e29b-41d4-a716-446655440000', role: 'buyer' },
      { currentPassword: 'OldPass1', newPassword: 'NewPass1' }
    );

    expect(mockUpdateUserById).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({
        $set: expect.objectContaining({
          password: 'new-hash',
          passwordChangedAt: expect.any(Date),
        }),
      })
    );
    expect(mockRevokeAllSessions).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
  });
});
