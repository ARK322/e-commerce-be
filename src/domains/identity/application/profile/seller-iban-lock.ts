import { AuthError } from '@/domains/identity/application/errors';

const normalizeIban = (iban: string) => iban.replace(/\s+/g, '').toUpperCase();

export const assertIbanUpdateAllowed = (
  existingIban: string | null | undefined,
  incomingIban: string | undefined
) => {
  if (incomingIban === undefined) {
    return;
  }

  const current = existingIban?.trim();

  if (!current) {
    return;
  }

  if (normalizeIban(incomingIban) !== normalizeIban(current)) {
    throw new AuthError(
      403,
      'IBAN kaydedildikten sonra değiştirilemez. Değişiklik için destek ile iletişime geçin.'
    );
  }
};

export const omitUnchangedLockedIban = (
  existingIban: string | null | undefined,
  data: Record<string, unknown>
) => {
  if (data.iban === undefined) {
    return data;
  }

  const current = existingIban?.trim();

  if (!current) {
    return data;
  }

  const { iban: _iban, ...rest } = data;
  return rest;
};
