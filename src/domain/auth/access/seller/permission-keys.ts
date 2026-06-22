export const SELLER_PERMISSIONS = {
  PRODUCTS_READ: 'products.read',
  PRODUCTS_WRITE: 'products.write',
  ORDERS_READ: 'orders.read',
  ORDERS_WRITE: 'orders.write',
  COMPANY_READ: 'company.read',
  COMPANY_WRITE: 'company.write',
  MEMBERS_READ: 'members.read',
  MEMBERS_WRITE: 'members.write',
  MEMBERS_DELETE: 'members.delete',
  ROLES_READ: 'roles.read',
  ROLES_WRITE: 'roles.write',
  ROLES_DELETE: 'roles.delete',
} as const;

export type SellerPermissionKey = (typeof SELLER_PERMISSIONS)[keyof typeof SELLER_PERMISSIONS];

export const ALL_SELLER_PERMISSIONS: SellerPermissionKey[] = Object.values(SELLER_PERMISSIONS);

export const SELLER_OWNER_ONLY_PERMISSIONS: SellerPermissionKey[] = [
  SELLER_PERMISSIONS.MEMBERS_WRITE,
  SELLER_PERMISSIONS.MEMBERS_DELETE,
  SELLER_PERMISSIONS.ROLES_WRITE,
  SELLER_PERMISSIONS.ROLES_DELETE,
];

export const ASSIGNABLE_SELLER_PERMISSIONS: SellerPermissionKey[] = ALL_SELLER_PERMISSIONS.filter(
  (permission) => !SELLER_OWNER_ONLY_PERMISSIONS.includes(permission)
);

/** Şahıs şirketi (bireysel) — ekip/rol yönetimi yok */
export const BIREYSEL_SELLER_PERMISSIONS: SellerPermissionKey[] = ALL_SELLER_PERMISSIONS.filter(
  (permission) =>
    !permission.startsWith('members.') && !permission.startsWith('roles.')
);

export const SELLER_PERMISSION_LABELS: Record<SellerPermissionKey, string> = {
  [SELLER_PERMISSIONS.PRODUCTS_READ]: 'Ürünleri görüntüle',
  [SELLER_PERMISSIONS.PRODUCTS_WRITE]: 'Ürün yönet',
  [SELLER_PERMISSIONS.ORDERS_READ]: 'Siparişleri görüntüle',
  [SELLER_PERMISSIONS.ORDERS_WRITE]: 'Sipariş durumu güncelle',
  [SELLER_PERMISSIONS.COMPANY_READ]: 'Şirket profilini görüntüle',
  [SELLER_PERMISSIONS.COMPANY_WRITE]: 'Şirket profilini düzenle',
  [SELLER_PERMISSIONS.MEMBERS_READ]: 'Ekibi görüntüle',
  [SELLER_PERMISSIONS.MEMBERS_WRITE]: 'Çalışan davet et',
  [SELLER_PERMISSIONS.MEMBERS_DELETE]: 'Çalışan sil',
  [SELLER_PERMISSIONS.ROLES_READ]: 'Rolleri görüntüle',
  [SELLER_PERMISSIONS.ROLES_WRITE]: 'Rol oluştur ve düzenle',
  [SELLER_PERMISSIONS.ROLES_DELETE]: 'Rol sil',
};

export const isSellerPermissionKey = (value: string): value is SellerPermissionKey =>
  ALL_SELLER_PERMISSIONS.includes(value as SellerPermissionKey);
