import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindBuyerById = vi.fn();
const mockUpdateBuyerById = vi.fn();

vi.mock('@/repositories/buyers/buyer.repository', () => ({
  findBuyerById: (...args: unknown[]) => mockFindBuyerById(...args),
  updateBuyerById: (...args: unknown[]) => mockUpdateBuyerById(...args),
}));

vi.mock('@/shared/ids', () => ({
  createUserId: () => 'new-address-id',
}));

import {
  addBuyerAddress,
  deleteBuyerAddress,
  listBuyerAddresses,
  resolveBuyerShippingAddress,
} from '@/domain/buyers/addresses';
import { CommerceError } from '@/shared/errors/commerce-error';

const buyerId = '550e8400-e29b-41d4-a716-446655440000';

const baseAddress = {
  _id: 'addr-1',
  label: 'Ev',
  firstName: 'Ali',
  lastName: 'Veli',
  phone: '+905551112233',
  country: 'Türkiye',
  city: 'İstanbul',
  address: 'Kadıköy',
  isDefaultDelivery: true,
  isDefaultBilling: false,
};

describe('listBuyerAddresses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mevcut adresleri listeler', async () => {
    mockFindBuyerById.mockResolvedValue({ addresses: [baseAddress] });

    const result = await listBuyerAddresses(buyerId);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('addr-1');
  });

  it('legacy profilden adres migrasyonu yapar', async () => {
    mockFindBuyerById.mockResolvedValue({
      addresses: [],
      firstName: 'Ali',
      lastName: 'Veli',
      phone: '+905551112233',
      country: 'Türkiye',
      city: 'İstanbul',
      deliveryAddress: 'Kadıköy',
      billingSameAsDelivery: true,
    });
    mockUpdateBuyerById.mockResolvedValue(undefined);

    const result = await listBuyerAddresses(buyerId);

    expect(mockUpdateBuyerById).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].isDefaultDelivery).toBe(true);
  });
});

describe('addBuyerAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateBuyerById.mockResolvedValue(undefined);
  });

  it('yeni adres ekler', async () => {
    mockFindBuyerById.mockResolvedValue({ addresses: [] });

    const result = await addBuyerAddress(buyerId, {
      firstName: 'Ali',
      lastName: 'Veli',
      phone: '+905551112233',
      country: 'Türkiye',
      city: 'İstanbul',
      address: 'Üsküdar',
    });

    expect(result.id).toBe('new-address-id');
    expect(mockUpdateBuyerById).toHaveBeenCalled();
  });
});

describe('deleteBuyerAddress', () => {
  it('olmayan adres için 404 fırlatır', async () => {
    mockFindBuyerById.mockResolvedValue({ addresses: [baseAddress] });

    await expect(deleteBuyerAddress(buyerId, 'missing')).rejects.toBeInstanceOf(CommerceError);
  });
});

describe('resolveBuyerShippingAddress', () => {
  it('varsayılan teslimat adresini döner', async () => {
    mockFindBuyerById.mockResolvedValue({ addresses: [baseAddress] });

    const result = await resolveBuyerShippingAddress(buyerId);

    expect(result.city).toBe('İstanbul');
    expect(result.address).toBe('Kadıköy');
  });

  it('adres yoksa 400 fırlatır', async () => {
    mockFindBuyerById.mockResolvedValue({ addresses: [] });

    await expect(resolveBuyerShippingAddress(buyerId)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
