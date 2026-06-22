import type { UserRole } from '@/domains/identity/application/tokens/access-token';

/**
 * Faz 3 / Aşama 2 — Stateless RBAC scope katmanı.
 *
 * Bu scope'lar JWT payload'ına gömülür ve gateway/alt servisler tarafından
 * DB'ye sormadan (stateless) okunur. Admin'in DB-tabanlı fine-grained
 * permission sistemi (adminContext.permissions) bundan AYRIDIR ve korunur;
 * scope'lar coarse-grained, rol-türevli bir üst katmandır.
 */
export const WILDCARD_SCOPE = '*';

export const SCOPES = {
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  CATEGORIES_READ: 'categories:read',
  CART_READ: 'cart:read',
  CART_WRITE: 'cart:write',
  ORDERS_READ: 'orders:read',
  ORDERS_CREATE: 'orders:create',
  FULFILLMENT_MANAGE: 'fulfillment:manage',
  WALLET_READ: 'wallet:read',
  SUPPORT_WRITE: 'support:write',
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES] | typeof WILDCARD_SCOPE;

/** Rol bazlı varsayılan scope setleri. */
const ROLE_SCOPES: Record<UserRole, string[]> = {
  buyer: [
    SCOPES.PRODUCTS_READ,
    SCOPES.CATEGORIES_READ,
    SCOPES.CART_READ,
    SCOPES.CART_WRITE,
    SCOPES.ORDERS_READ,
    SCOPES.ORDERS_CREATE,
    SCOPES.SUPPORT_WRITE,
  ],
  seller: [
    SCOPES.PRODUCTS_READ,
    SCOPES.PRODUCTS_WRITE,
    SCOPES.CATEGORIES_READ,
    SCOPES.FULFILLMENT_MANAGE,
    SCOPES.ORDERS_READ,
    SCOPES.WALLET_READ,
    SCOPES.SUPPORT_WRITE,
  ],
  admin: [WILDCARD_SCOPE],
};

/** Rol için varsayılan scope listesi (yeni token üretiminde ve legacy token fallback'inde kullanılır). */
export const getDefaultScopesForRole = (role: UserRole): string[] => [
  ...(ROLE_SCOPES[role] ?? []),
];

/** Verilen scope seti istenen scope'u karşılıyor mu? (wildcard '*' her şeyi karşılar). */
export const hasScope = (granted: string[], required: string): boolean =>
  granted.includes(WILDCARD_SCOPE) || granted.includes(required);

/** Scope alanını normalize eder: dizi değilse/boşsa role'den türetir (geriye uyumluluk). */
export const normalizeScopes = (raw: unknown, role: UserRole): string[] => {
  if (Array.isArray(raw) && raw.every((s) => typeof s === 'string') && raw.length > 0) {
    return raw as string[];
  }

  return getDefaultScopesForRole(role);
};
