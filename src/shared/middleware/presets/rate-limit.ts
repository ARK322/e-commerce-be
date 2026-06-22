export {
  AUTH_ADMIN_RATE_LIMIT,
  AUTH_AUTHENTICATED_RATE_LIMIT,
  AUTH_LOGIN_RATE_LIMIT,
  AUTH_PUBLIC_RATE_LIMIT,
  AUTH_RECOVERY_RATE_LIMIT,
  AUTH_REGISTER_RATE_LIMIT,
  AUTH_SELLER_RATE_LIMIT,
  ADMIN_CATEGORIES_RATE_LIMIT,
  BUYERS_RATE_LIMIT,
  CATALOG_PUBLIC_RATE_LIMIT,
  GLOBAL_RATE_LIMIT,
  PAYMENT_CALLBACK_RATE_LIMIT,
  SELLERS_WRITE_RATE_LIMIT,
} from '@/config/constants';

export type RateLimitPreset = {
  max: number;
  timeWindow: string;
};

/** Route config — global limit devre dışı (Iyzico callback vb.). */
export const disabledRouteRateLimit = {
  rateLimit: false as const,
};
