export const SELLER_CRITICAL_FIELDS = [
  'sellerType',
  'companyName',
  'taxNumber',
  'taxOffice',
  'country',
  'city',
  'district',
  'companyAddress',
  'taxCertificateUrl',
  'signatureCircularUrl',
  'bankName',
  'iban',
  'accountHolderName',
  'authorizedFirstName',
  'authorizedLastName',
  'authorizedPhone',
  'companyPhone',
  'companyType',
] as const;

type SellerCriticalField = (typeof SELLER_CRITICAL_FIELDS)[number];

const isCriticalField = (key: string): key is SellerCriticalField =>
  (SELLER_CRITICAL_FIELDS as readonly string[]).includes(key);

export const hasCriticalSellerFieldChanges = (
  current: Record<string, unknown>,
  update: Record<string, unknown>
) =>
  Object.entries(update).some(([key, newValue]) => {
    if (!isCriticalField(key)) {
      return false;
    }

    return String(current[key] ?? '') !== String(newValue ?? '');
  });
