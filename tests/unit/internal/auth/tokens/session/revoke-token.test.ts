import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const mockRevokedTokenExists = vi.fn();
const mockRevokedTokenUpdateOne = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  RevokedToken: {
    exists: (...args: unknown[]) => mockRevokedTokenExists(...args),
    updateOne: (...args: unknown[]) => mockRevokedTokenUpdateOne(...args),
  },
}));

import { isTokenRevoked, revokeToken } from '@/internal/auth/tokens/revoke-token';

describe('revoke-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
    mockRevokedTokenUpdateOne.mockResolvedValue({});
  });

  it('revoke edilmiş token true döner', async () => {
    mockRevokedTokenExists.mockResolvedValue({ _id: 'hash' });

    const revoked = await isTokenRevoked('some-token');

    expect(revoked).toBe(true);
  });

  it('revoke edilmemiş token false döner', async () => {
    mockRevokedTokenExists.mockResolvedValue(null);

    const revoked = await isTokenRevoked('some-token');

    expect(revoked).toBe(false);
  });

  it('geçerli token revoke edilir', async () => {
    const token = jwt.sign({ purpose: 'access', role: 'buyer' }, process.env.JWT_SECRET!, {
      subject: '550e8400-e29b-41d4-a716-446655440000',
      expiresIn: '1h',
    });

    await revokeToken(token);

    expect(mockRevokedTokenUpdateOne).toHaveBeenCalledWith(
      { _id: expect.any(String) },
      {
        $set: { expiresAt: expect.any(Date) },
        $setOnInsert: { _id: expect.any(String) },
      },
      { upsert: true }
    );
  });
});
