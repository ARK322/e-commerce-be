export { adminOnly } from '@/shared/middleware/presets/admin-route-guards';
export { buyerOnly, buyerWithParams } from '@/shared/middleware/presets/buyer-route-guards';
export { sellerTeamBase } from '@/shared/middleware/presets/seller-route-guards';
export {
  AUTH_ADMIN_RATE_LIMIT,
  AUTH_PUBLIC_RATE_LIMIT,
  AUTH_SELLER_RATE_LIMIT,
  ADMIN_CATEGORIES_RATE_LIMIT,
  BUYERS_RATE_LIMIT,
  CATALOG_PUBLIC_RATE_LIMIT,
  GLOBAL_RATE_LIMIT,
  SELLERS_WRITE_RATE_LIMIT,
  disabledRouteRateLimit,
  type RateLimitPreset,
} from '@/shared/middleware/presets/rate-limit';
