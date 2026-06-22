import { describe, expect, it } from 'vitest';
import { adminOnly } from '@/shared/middleware/presets/admin-route-guards';
import { requireAuth } from '@/shared/middleware/auth/require-auth';
import { requireAdmin } from '@/shared/middleware/auth/require-admin';

describe('adminOnly', () => {
  it('requireAuth ve requireAdmin sırasını korur', () => {
    expect(adminOnly.preHandler).toEqual([requireAuth, requireAdmin]);
  });
});
