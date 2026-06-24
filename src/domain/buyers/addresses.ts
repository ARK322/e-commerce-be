import { CommerceError } from '@/shared/errors/commerce-error';
import { createUserId } from '@/shared/ids';
import { findBuyerById, updateBuyerById } from '@/repositories/buyers/buyer.repository';

export type BuyerAddressInput = {
  label?: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  isDefaultDelivery?: boolean;
  isDefaultBilling?: boolean;
};

type BuyerAddressRecord = BuyerAddressInput & { _id: string };

const normalizeAddressFlags = (
  addresses: BuyerAddressRecord[],
  targetId: string,
  flags: { isDefaultDelivery?: boolean; isDefaultBilling?: boolean }
) => {
  if (flags.isDefaultDelivery) {
    for (const address of addresses) {
      address.isDefaultDelivery = address._id === targetId;
    }
  }

  if (flags.isDefaultBilling) {
    for (const address of addresses) {
      address.isDefaultBilling = address._id === targetId;
    }
  }
};

const syncLegacyDeliveryFields = (addresses: BuyerAddressRecord[]) => {
  const defaultDelivery = addresses.find((address) => address.isDefaultDelivery) ?? addresses[0];

  if (!defaultDelivery) {
    return {};
  }

  return {
    firstName: defaultDelivery.firstName,
    lastName: defaultDelivery.lastName,
    phone: defaultDelivery.phone,
    country: defaultDelivery.country,
    city: defaultDelivery.city,
    deliveryAddress: defaultDelivery.address,
    defaultDeliveryAddressId: defaultDelivery._id,
  };
};

export const ensureBuyerAddressesMigrated = async (buyerId: string) => {
  const buyer = await findBuyerById(buyerId);

  if (!buyer) {
    throw new CommerceError(404, 'Alıcı profili bulunamadı');
  }

  const addresses = (buyer.addresses ?? []) as BuyerAddressRecord[];

  if (addresses.length > 0) {
    return addresses;
  }

  if (
    !buyer.firstName ||
    !buyer.lastName ||
    !buyer.phone ||
    !buyer.country ||
    !buyer.city ||
    !buyer.deliveryAddress
  ) {
    return addresses;
  }

  const addressId = createUserId();
  const migrated: BuyerAddressRecord[] = [
    {
      _id: addressId,
      label: 'Varsayılan',
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      phone: buyer.phone,
      country: buyer.country,
      city: buyer.city,
      address: buyer.deliveryAddress,
      isDefaultDelivery: true,
      isDefaultBilling: buyer.billingSameAsDelivery ?? false,
    },
  ];

  await updateBuyerById(buyerId, {
    $set: {
      addresses: migrated,
      defaultDeliveryAddressId: addressId,
      defaultBillingAddressId: buyer.billingSameAsDelivery ? addressId : buyer.defaultBillingAddressId,
    },
  });

  return migrated;
};

export const listBuyerAddresses = async (buyerId: string) => {
  const addresses = await ensureBuyerAddressesMigrated(buyerId);
  return addresses.map((address) => ({
    id: address._id,
    label: address.label ?? null,
    firstName: address.firstName,
    lastName: address.lastName,
    phone: address.phone,
    country: address.country,
    city: address.city,
    address: address.address,
    isDefaultDelivery: address.isDefaultDelivery ?? false,
    isDefaultBilling: address.isDefaultBilling ?? false,
  }));
};

export const addBuyerAddress = async (buyerId: string, input: BuyerAddressInput) => {
  const buyer = await findBuyerById(buyerId);

  if (!buyer) {
    throw new CommerceError(404, 'Alıcı profili bulunamadı');
  }

  const addresses = [...((buyer.addresses ?? []) as BuyerAddressRecord[])];
  const addressId = createUserId();
  const created: BuyerAddressRecord = {
    _id: addressId,
    ...input,
    isDefaultDelivery: input.isDefaultDelivery ?? addresses.length === 0,
    isDefaultBilling: input.isDefaultBilling ?? false,
  };

  addresses.push(created);
  normalizeAddressFlags(addresses, addressId, {
    isDefaultDelivery: created.isDefaultDelivery,
    isDefaultBilling: created.isDefaultBilling,
  });

  const legacySync = syncLegacyDeliveryFields(addresses);

  await updateBuyerById(buyerId, {
    $set: {
      addresses,
      ...legacySync,
    },
  });

  return {
    id: addressId,
    ...input,
    isDefaultDelivery: created.isDefaultDelivery ?? false,
    isDefaultBilling: created.isDefaultBilling ?? false,
  };
};

export const updateBuyerAddress = async (
  buyerId: string,
  addressId: string,
  input: Partial<BuyerAddressInput>
) => {
  const buyer = await findBuyerById(buyerId);

  if (!buyer) {
    throw new CommerceError(404, 'Alıcı profili bulunamadı');
  }

  const addresses = [...((buyer.addresses ?? []) as BuyerAddressRecord[])];
  const index = addresses.findIndex((address) => address._id === addressId);

  if (index < 0) {
    throw new CommerceError(404, 'Adres bulunamadı');
  }

  addresses[index] = {
    ...addresses[index],
    ...input,
  };

  normalizeAddressFlags(addresses, addressId, {
    isDefaultDelivery: input.isDefaultDelivery,
    isDefaultBilling: input.isDefaultBilling,
  });

  const legacySync = syncLegacyDeliveryFields(addresses);

  await updateBuyerById(buyerId, {
    $set: {
      addresses,
      ...legacySync,
    },
  });

  const updated = addresses[index];

  return {
    id: updated._id,
    label: updated.label ?? null,
    firstName: updated.firstName,
    lastName: updated.lastName,
    phone: updated.phone,
    country: updated.country,
    city: updated.city,
    address: updated.address,
    isDefaultDelivery: updated.isDefaultDelivery ?? false,
    isDefaultBilling: updated.isDefaultBilling ?? false,
  };
};

export const deleteBuyerAddress = async (buyerId: string, addressId: string) => {
  const buyer = await findBuyerById(buyerId);

  if (!buyer) {
    throw new CommerceError(404, 'Alıcı profili bulunamadı');
  }

  const addresses = ((buyer.addresses ?? []) as BuyerAddressRecord[]).filter(
    (address) => address._id !== addressId
  );

  if (addresses.length === (buyer.addresses ?? []).length) {
    throw new CommerceError(404, 'Adres bulunamadı');
  }

  if (addresses.length > 0 && !addresses.some((address) => address.isDefaultDelivery)) {
    addresses[0].isDefaultDelivery = true;
  }

  const legacySync = syncLegacyDeliveryFields(addresses);

  await updateBuyerById(buyerId, {
    $set: {
      addresses,
      ...legacySync,
    },
  });

  return { deleted: true };
};

export const resolveBuyerShippingAddress = async (buyerId: string, addressId?: string) => {
  const addresses = await ensureBuyerAddressesMigrated(buyerId);

  const selected = addressId
    ? addresses.find((address) => address._id === addressId)
    : addresses.find((address) => address.isDefaultDelivery) ?? addresses[0];

  if (!selected) {
    const buyer = await findBuyerById(buyerId);

    if (
      buyer?.firstName &&
      buyer.lastName &&
      buyer.phone &&
      buyer.country &&
      buyer.city &&
      buyer.deliveryAddress
    ) {
      return {
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        phone: buyer.phone,
        country: buyer.country,
        city: buyer.city,
        address: buyer.deliveryAddress,
      };
    }

    throw new CommerceError(400, 'Sipariş için teslimat adresi eksik');
  }

  return {
    firstName: selected.firstName,
    lastName: selected.lastName,
    phone: selected.phone,
    country: selected.country,
    city: selected.city,
    address: selected.address,
  };
};
