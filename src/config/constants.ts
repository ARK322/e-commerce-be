export const DEFAULT_PORT = 8080;

export const DEFAULT_LOG_LEVEL = 'info' as const;

export const DEFAULT_FRONTEND_URL = 'http://localhost:3000';

export const DEFAULT_DEV_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
] as const;

export const SUPABASE_DEFAULT_BUCKET = 'seller-documents';

export const IYZICO_SANDBOX_URI = 'https://sandbox-api.iyzipay.com';

export const IYZICO_PRODUCTION_URI = 'https://api.iyzipay.com';

export const DEFAULT_PENDING_ORDER_TTL_MINUTES = 15;

export const DEFAULT_PENDING_ORDER_EXPIRY_INTERVAL_MS = 60_000;

export const GLOBAL_RATE_LIMIT = {
  max: 100,
  timeWindow: '1 minute' as const,
};

export const AUTH_PUBLIC_RATE_LIMIT = {
  max: 10,
  timeWindow: '15 minutes' as const,
};

export const AUTH_ADMIN_RATE_LIMIT = {
  max: 60,
  timeWindow: '1 minute' as const,
};

export const AUTH_SELLER_RATE_LIMIT = {
  max: 60,
  timeWindow: '1 minute' as const,
};

export const CATALOG_PUBLIC_RATE_LIMIT = {
  max: 120,
  timeWindow: '1 minute' as const,
};

export const BUYERS_RATE_LIMIT = {
  max: 60,
  timeWindow: '1 minute' as const,
};

export const SELLERS_WRITE_RATE_LIMIT = {
  max: 30,
  timeWindow: '1 minute' as const,
};

export const PAYMENT_CALLBACK_RATE_LIMIT = {
  max: 30,
  timeWindow: '1 minute' as const,
};

export const AUTH_AUTHENTICATED_RATE_LIMIT = {
  max: 30,
  timeWindow: '1 minute' as const,
};

export const ADMIN_CATEGORIES_RATE_LIMIT = {
  max: 60,
  timeWindow: '1 minute' as const,
};

/** Ürün görsel upload — product.routes scope. */
export const PRODUCT_MULTIPART_LIMITS = {
  fileSize: 2 * 1024 * 1024,
  files: 10,
} as const;

/** Satıcı belge upload — profile/documents scope. */
export const PROFILE_DOCUMENT_MULTIPART_LIMITS = {
  fileSize: 5 * 1024 * 1024,
  files: 1,
} as const;

export const CORS_ALLOWED_METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
] as const;
