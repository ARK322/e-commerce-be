import { describe, expect, it } from 'vitest';
import { hasCriticalSellerFieldChanges } from './seller-critical-fields';

describe('hasCriticalSellerFieldChanges', () => {
  it('kritik alan değişince true döner', () => {
    const changed = hasCriticalSellerFieldChanges(
      { taxNumber: '1234567890' },
      { taxNumber: '0987654321' }
    );

    expect(changed).toBe(true);
  });

  it('kritik olmayan alan değişince false döner', () => {
    const changed = hasCriticalSellerFieldChanges(
      { companyDescription: 'Eski açıklama' },
      { companyDescription: 'Yeni açıklama' }
    );

    expect(changed).toBe(false);
  });
});
