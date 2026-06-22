import Iyzipay from 'iyzipay';
import { getIyzicoClient } from '@/infrastructure/iyzico/client';
import { formatIyzicoPhone } from '@/infrastructure/iyzico/format';
import { promisifyIyzipay } from '@/infrastructure/iyzico/promisify';
import { HttpError } from '@/shared/errors';

type SellerSubMerchantProfile = {
  sellerId: string;
  email: string;
  sellerType?: 'bireysel' | 'kurumsal' | null;
  companyType?: 'ltd' | 'as' | null;
  authorizedFirstName?: string | null;
  authorizedLastName?: string | null;
  companyPhone?: string | null;
  phone?: string | null;
  companyName?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  companyAddress?: string | null;
  iban?: string | null;
};

const resolveContactName = (profile: SellerSubMerchantProfile) => {
  const firstName = profile.authorizedFirstName;
  const lastName = profile.authorizedLastName;

  if (!firstName || !lastName) {
    throw new HttpError(400, 'Satıcı yetkili ad/soyad bilgisi eksik');
  }

  return { contactName: firstName, contactSurname: lastName };
};

const resolvePhone = (profile: SellerSubMerchantProfile) => {
  const phone = profile.companyPhone ?? profile.phone;

  if (!phone) {
    throw new HttpError(400, 'Satıcı telefon bilgisi eksik');
  }

  return formatIyzicoPhone(phone);
};

const buildSubMerchantRequest = (profile: SellerSubMerchantProfile) => {
  if (!profile.email) {
    throw new HttpError(400, 'Satıcı e-posta bilgisi eksik');
  }

  if (!profile.iban?.trim()) {
    throw new HttpError(400, 'Satıcı IBAN bilgisi eksik');
  }

  if (!profile.companyAddress?.trim()) {
    throw new HttpError(400, 'Satıcı adres bilgisi eksik');
  }

  if (!profile.companyName?.trim()) {
    throw new HttpError(400, 'Satıcı ticari unvan bilgisi eksik');
  }

  if (!profile.taxNumber?.trim()) {
    throw new HttpError(400, 'Satıcı vergi numarası eksik');
  }

  if (!profile.taxOffice?.trim()) {
    throw new HttpError(400, 'Satıcı vergi dairesi eksik');
  }

  const { contactName, contactSurname } = resolveContactName(profile);
  const gsmNumber = resolvePhone(profile);
  const base = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: profile.sellerId,
    subMerchantExternalId: profile.sellerId,
    email: profile.email,
    gsmNumber,
    address: profile.companyAddress,
    iban: profile.iban.replace(/\s+/g, '').toUpperCase(),
    currency: Iyzipay.CURRENCY.TRY,
    taxOffice: profile.taxOffice.trim(),
    taxNumber: profile.taxNumber.trim(),
    name: profile.companyName.trim(),
  };

  if (profile.sellerType === 'bireysel') {
    return {
      ...base,
      subMerchantType: Iyzipay.SUB_MERCHANT_TYPE.PRIVATE_COMPANY,
      contactName,
      contactSurname,
    };
  }

  if (profile.companyType !== 'ltd' && profile.companyType !== 'as') {
    throw new HttpError(400, 'Kurumsal satıcı için şirket tipi (ltd/as) eksik');
  }

  return {
    ...base,
    subMerchantType: Iyzipay.SUB_MERCHANT_TYPE.LIMITED_OR_JOINT_STOCK_COMPANY,
    legalCompanyTitle: profile.companyName.trim(),
  };
};

export const createIyzicoSubMerchant = async (
  profile: SellerSubMerchantProfile
): Promise<string> => {
  const client = getIyzicoClient();
  const request = buildSubMerchantRequest(profile);

  const result = await promisifyIyzipay(
    client.subMerchant.create!.bind(client.subMerchant),
    request
  );

  if (result.status !== 'success' || !result.subMerchantKey) {
    throw new HttpError(
      502,
      result.errorMessage ?? 'Iyzico alt üye kaydı oluşturulamadı'
    );
  }

  return result.subMerchantKey;
};
