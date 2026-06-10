type ProfileRecord = Record<string, unknown>;

const hasValue = (value: unknown) =>
  value !== undefined && value !== null && String(value).trim() !== '';

const hasRequiredFields = (record: ProfileRecord, fields: string[]) =>
  fields.every((field) => hasValue(record[field]));

const BUYER_REQUIRED = [
  'firstName',
  'lastName',
  'phone',
  'country',
  'city',
  'nationalId',
  'deliveryAddress',
];

const SELLER_COMMON_REQUIRED = [
  'sellerType',
  'companyName',
  'taxNumber',
  'taxOffice',
  'country',
  'city',
  'district',
  'companyAddress',
  'taxCertificateUrl',
  'bankName',
  'iban',
  'accountHolderName',
  'companyLogoUrl',
  'companyDescription',
];

const SELLER_BIREYSEL_REQUIRED = ['firstName', 'lastName', 'phone'];

const SELLER_KURUMSAL_REQUIRED = [
  'authorizedFirstName',
  'authorizedLastName',
  'authorizedPhone',
  'companyPhone',
  'companyType',
  'signatureCircularUrl',
];

export const isBuyerProfileComplete = (buyer: ProfileRecord) => {
  if (!hasRequiredFields(buyer, BUYER_REQUIRED)) {
    return false;
  }

  if (buyer.billingSameAsDelivery === true) {
    return hasValue(buyer.deliveryAddress);
  }

  return hasValue(buyer.billingAddress);
};

export const isSellerProfileComplete = (seller: ProfileRecord) => {
  if (!hasRequiredFields(seller, SELLER_COMMON_REQUIRED)) {
    return false;
  }

  if (seller.sellerType === 'bireysel') {
    return hasRequiredFields(seller, SELLER_BIREYSEL_REQUIRED);
  }

  if (seller.sellerType === 'kurumsal') {
    return hasRequiredFields(seller, SELLER_KURUMSAL_REQUIRED);
  }

  return false;
};
