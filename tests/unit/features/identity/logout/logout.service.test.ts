import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateUserById = vi.fn();
const mockRevokeToken = vi.fn();

vi.mock('@/domains/identity/infrastructure/repositories/auth/user.repository', () => ({
  updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
}));

vi.mock('@/domains/identity/application/tokens/revoke-token', () => ({
  revokeToken: (...args: unknown[]) => mockRevokeToken(...args),
}));

import { logout, logoutAllSessions } from '@/api/auth/logout/logout.service';

describe('logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokeToken.mockResolvedValue(undefined);
    mockUpdateUserById.mockResolvedValue({});
  });

  it('token revoke edilir', async () => {
    await logout('access-token-123');

    expect(mockRevokeToken).toHaveBeenCalledWith('access-token-123');
  });
});

describe('logoutAllSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUserById.mockResolvedValue({});
  });

  it('sessionsRevokedAt günceller', async () => {
    await logoutAllSessions('550e8400-e29b-41d4-a716-446655440000');

    expect(mockUpdateUserById).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      { $set: { sessionsRevokedAt: expect.any(Date) } }
    );
  });
});
