import { describe, expect, it } from 'vitest';
import { AuthError } from '@/domain/auth/errors';
import {
  assertIbanUpdateAllowed,
  omitUnchangedLockedIban,
} from '@/domain/auth/profile/seller-iban-lock';

describe('seller-iban-lock', () => {
  it('IBAN yokken güncellemeye izin verir', () => {
    expect(() =>
      assertIbanUpdateAllowed(null, 'TR330006100519786457841326')
    ).not.toThrow();
  });

  it('kayıtlı IBAN değiştirilmeye çalışılırsa 403 fırlatır', () => {
    expect(() =>
      assertIbanUpdateAllowed(
        'TR330006100519786457841326',
        'TR760006400000100000000000'
      )
    ).toThrow(AuthError);
  });

  it('aynı IBAN tekrar gönderilirse izin verir', () => {
    expect(() =>
      assertIbanUpdateAllowed(
        'TR330006100519786457841326',
        'TR330006100519786457841326'
      )
    ).not.toThrow();
  });

  it('aynı IBAN gönderilirse update payloadından çıkarır', () => {
    expect(
      omitUnchangedLockedIban('TR330006100519786457841326', {
        iban: 'TR330006100519786457841326',
        companyName: 'Test',
      })
    ).toEqual({ companyName: 'Test' });
  });
});
