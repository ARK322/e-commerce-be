export {
  AUTH_ADMIN_RATE_LIMIT,
  AUTH_PUBLIC_RATE_LIMIT,
  AUTH_SELLER_RATE_LIMIT,
  ECOMMERCE_ADMIN_RATE_LIMIT,
  ECOMMERCE_BUYER_RATE_LIMIT,
  ECOMMERCE_PUBLIC_RATE_LIMIT,
  ECOMMERCE_SELLER_WRITE_RATE_LIMIT,
  GLOBAL_RATE_LIMIT,
} from '@/config/constants';

export type RateLimitPreset = {
  max: number;
  timeWindow: string;
};

/** Route config — global limit devre dışı (Iyzico callback vb.). */
export const disabledRouteRateLimit = {
  rateLimit: false as const,
};
