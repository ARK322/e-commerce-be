import { describe, expect, it } from 'vitest';
import { createAdminSchema } from '@/api/admin/admins/create-admin.schema';

describe('createAdminSchema', () => {
  it('geçerli admin oluşturmayı kabul eder', () => {
    const result = createAdminSchema.safeParse({
      email: 'admin@example.com',
      password: 'SecurePass1',
      roleId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });
});
