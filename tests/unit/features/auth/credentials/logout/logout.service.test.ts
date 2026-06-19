import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindByIdAndUpdate = vi.fn();
const mockRevokeToken = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  User: {
    findByIdAndUpdate: (...args: unknown[]) => mockFindByIdAndUpdate(...args),
  },
}));

vi.mock('@/internal/auth/tokens/revoke-token', () => ({
  revokeToken: (...args: unknown[]) => mockRevokeToken(...args),
}));

import { logout, logoutAllSessions } from '@/features/auth/credentials/logout/logout.service';

describe('logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokeToken.mockResolvedValue(undefined);
    mockFindByIdAndUpdate.mockResolvedValue({});
  });

  it('token revoke edilir', async () => {
    await logout('access-token-123');

    expect(mockRevokeToken).toHaveBeenCalledWith('access-token-123');
  });
});

describe('logoutAllSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByIdAndUpdate.mockResolvedValue({});
  });

  it('sessionsRevokedAt günceller', async () => {
    await logoutAllSessions('550e8400-e29b-41d4-a716-446655440000');

    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      { sessionsRevokedAt: expect.any(Date) }
    );
  });
});
