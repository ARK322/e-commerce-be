import dotenv from 'dotenv';
import { z } from 'zod';
import {
  DEFAULT_CATALOG_CATEGORIES_CACHE_TTL_MS,
  DEFAULT_CATALOG_PRODUCT_DETAIL_CACHE_TTL_MS,
  DEFAULT_CATALOG_PRODUCTS_LIST_CACHE_TTL_MS,
  DEFAULT_CATALOG_VISIBLE_CATEGORIES_CACHE_TTL_MS,
  DEFAULT_DEV_CORS_ORIGINS,
  DEFAULT_FRONTEND_URL,
  DEFAULT_LOG_LEVEL,
  DEFAULT_PENDING_ORDER_EXPIRY_INTERVAL_MS,
  DEFAULT_PENDING_ORDER_TTL_MINUTES,
  DEFAULT_PORT,
  IYZICO_PRODUCTION_URI,
  IYZICO_SANDBOX_URI,
  SUPABASE_DEFAULT_BUCKET,
} from '@/config/constants';

if (!process.env.RAILWAY_ENVIRONMENT && process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

const nodeEnvSchema = z.enum(['development', 'production', 'test']);

const trim = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const parsePort = (raw: string | undefined): number => {
  if (!raw?.trim()) {
    return DEFAULT_PORT;
  }

  const port = Number(raw);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('PORT geçersiz bir sayı');
  }

  return port;
};

const parseCommissionRate = (raw: string | undefined): number => {
  if (!raw?.trim()) {
    throw new Error('PLATFORM_COMMISSION_RATE tanımlı olmalı (örn. 0.10 = %10 komisyon)');
  }

  const rate = Number(raw);

  if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
    throw new Error('PLATFORM_COMMISSION_RATE 0 ile 1 arasında olmalı (örn. 0.10 = %10)');
  }

  return rate;
};

const requireNonEmpty = (value: string | undefined, key: string): string => {
  const trimmed = trim(value);

  if (!trimmed) {
    throw new Error(`${key} tanımlanmamış`);
  }

  return trimmed;
};

const parsePositiveMs = (raw: string | undefined, fallback: number): number => {
  if (!raw?.trim()) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return value;
};

const parseBooleanEnv = (raw: string | undefined, fallback: boolean): boolean => {
  if (!raw?.trim()) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();

  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  return fallback;
};

/**
 * Runtime env erişimi — getter'lar process.env'i okur (testlerde beforeEach ile override edilebilir).
 */
export const env = {
  get nodeEnv(): z.infer<typeof nodeEnvSchema> | 'development' {
    const raw = process.env.NODE_ENV;
    if (!raw) {
      return 'development';
    }

    const parsed = nodeEnvSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `NODE_ENV geçersiz: "${raw}". İzin verilen değerler: development, production, test`
      );
    }

    return parsed.data;
  },

  get isProduction(): boolean {
    return env.nodeEnv === 'production';
  },

  get port(): number {
    return parsePort(process.env.PORT);
  },

  get logLevel(): z.infer<typeof logLevelSchema> {
    const raw = trim(process.env.LOG_LEVEL);
    if (!raw) {
      return DEFAULT_LOG_LEVEL;
    }

    return logLevelSchema.parse(raw);
  },

  get mongoUri(): string | undefined {
    return (
      trim(process.env.MONGO_URI) ||
      trim(process.env.MONGO_URL) ||
      trim(process.env.MONGODB_URI) ||
      trim(process.env.DATABASE_URL)
    );
  },

  get jwtSecret(): string {
    return requireNonEmpty(process.env.JWT_SECRET, 'JWT_SECRET');
  },

  get resendApiKey(): string {
    return requireNonEmpty(process.env.SMTP_PASS, 'SMTP_PASS (Resend API anahtarı)');
  },

  get mailFrom(): string {
    return requireNonEmpty(process.env.SMTP_FROM, 'SMTP_FROM');
  },

  get frontendUrl(): string {
    return requireNonEmpty(process.env.FRONTEND_URL, 'FRONTEND_URL');
  },

  get frontendUrlOrDefault(): string {
    return trim(process.env.FRONTEND_URL) ?? DEFAULT_FRONTEND_URL;
  },

  get corsOriginsRaw(): string | undefined {
    return trim(process.env.CORS_ORIGINS) ?? trim(process.env.FRONTEND_URL);
  },

  get allowedOrigins(): string[] {
    const raw = env.corsOriginsRaw;

    if (raw) {
      return raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    }

    if (env.isProduction) {
      return [];
    }

    return [...DEFAULT_DEV_CORS_ORIGINS];
  },

  get supabaseUrl(): string | undefined {
    return trim(process.env.SUPABASE_URL);
  },

  get supabaseServiceRoleKey(): string | undefined {
    return trim(process.env.SUPABASE_SERVICE_ROLE_KEY);
  },

  get supabaseStorageBucket(): string {
    return trim(process.env.SUPABASE_STORAGE_BUCKET) ?? SUPABASE_DEFAULT_BUCKET;
  },

  get iyzipayApiKey(): string | undefined {
    return trim(process.env.IYZIPAY_API_KEY);
  },

  get iyzipaySecretKey(): string | undefined {
    return trim(process.env.IYZIPAY_SECRET_KEY);
  },

  get iyzipayUri(): string | undefined {
    return trim(process.env.IYZIPAY_URI);
  },

  get iyzipayCallbackUrl(): string | undefined {
    return trim(process.env.IYZIPAY_CALLBACK_URL);
  },

  get apiBaseUrl(): string | undefined {
    return trim(process.env.API_BASE_URL);
  },

  get platformCommissionRate(): number {
    return parseCommissionRate(process.env.PLATFORM_COMMISSION_RATE);
  },

  get pendingOrderTtlMs(): number {
    const raw = trim(process.env.PENDING_ORDER_TTL_MINUTES);
    const minutes = raw ? Number(raw) : DEFAULT_PENDING_ORDER_TTL_MINUTES;

    if (!Number.isFinite(minutes) || minutes <= 0) {
      return DEFAULT_PENDING_ORDER_TTL_MINUTES * 60_000;
    }

    return minutes * 60_000;
  },

  get pendingOrderExpiryIntervalMs(): number {
    return DEFAULT_PENDING_ORDER_EXPIRY_INTERVAL_MS;
  },

  get catalogCacheEnabled(): boolean {
    return parseBooleanEnv(process.env.CATALOG_CACHE_ENABLED, true);
  },

  get catalogCategoriesCacheTtlMs(): number {
    return parsePositiveMs(
      process.env.CATALOG_CATEGORIES_CACHE_TTL_MS,
      DEFAULT_CATALOG_CATEGORIES_CACHE_TTL_MS
    );
  },

  get catalogProductsListCacheTtlMs(): number {
    return parsePositiveMs(
      process.env.CATALOG_PRODUCTS_LIST_CACHE_TTL_MS,
      DEFAULT_CATALOG_PRODUCTS_LIST_CACHE_TTL_MS
    );
  },

  get catalogProductDetailCacheTtlMs(): number {
    return parsePositiveMs(
      process.env.CATALOG_PRODUCT_DETAIL_CACHE_TTL_MS,
      DEFAULT_CATALOG_PRODUCT_DETAIL_CACHE_TTL_MS
    );
  },

  get catalogVisibleCategoriesCacheTtlMs(): number {
    return parsePositiveMs(
      process.env.CATALOG_VISIBLE_CATEGORIES_CACHE_TTL_MS,
      DEFAULT_CATALOG_VISIBLE_CATEGORIES_CACHE_TTL_MS
    );
  },

  resolveIyzicoUri(apiKey: string): string {
    if (env.iyzipayUri) {
      return env.iyzipayUri;
    }

    return apiKey.startsWith('sandbox-') ? IYZICO_SANDBOX_URI : IYZICO_PRODUCTION_URI;
  },

  resolveIyzipayCallbackUrl(): string | undefined {
    if (env.iyzipayCallbackUrl) {
      return env.iyzipayCallbackUrl;
    }

    if (env.apiBaseUrl) {
      return `${env.apiBaseUrl.replace(/\/+$/, '')}/payments/callback`;
    }

    return undefined;
  },
};

const startupEnvSchema = z.object({
  mongoUri: z.string().min(1, 'MongoDB bağlantı adresi bulunamadı'),
  jwtSecret: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  platformCommissionRate: z
    .string()
    .min(1, 'PLATFORM_COMMISSION_RATE tanımlı olmalı (örn. 0.10 = %10 komisyon)'),
});

const productionStartupEnvSchema = z.object({
  frontendUrl: z.string().min(1, 'FRONTEND_URL tanımlanmamış'),
  resendApiKey: z.string().min(1, 'SMTP_PASS (Resend API anahtarı) tanımlanmamış'),
  mailFrom: z.string().min(1, 'SMTP_FROM tanımlanmamış'),
  supabaseUrl: z.string().min(1, 'SUPABASE_URL tanımlanmamış'),
  supabaseServiceRoleKey: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY tanımlanmamış'),
  iyzipayApiKey: z.string().min(1, 'IYZIPAY_API_KEY tanımlanmamış'),
  iyzipaySecretKey: z.string().min(1, 'IYZIPAY_SECRET_KEY tanımlanmamış'),
});

/** Sunucu başlatılırken zorunlu env değişkenlerini doğrular. */
export const validateEnvAtStartup = (): void => {
  void env.nodeEnv;

  const result = startupEnvSchema.safeParse({
    mongoUri: env.mongoUri ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    platformCommissionRate: process.env.PLATFORM_COMMISSION_RATE ?? '',
  });

  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join('; ');
    throw new Error(message);
  }

  parseCommissionRate(process.env.PLATFORM_COMMISSION_RATE);

  if (env.isProduction) {
    const productionResult = productionStartupEnvSchema.safeParse({
      frontendUrl: process.env.FRONTEND_URL ?? '',
      resendApiKey: process.env.SMTP_PASS ?? '',
      mailFrom: process.env.SMTP_FROM ?? '',
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      iyzipayApiKey: process.env.IYZIPAY_API_KEY ?? '',
      iyzipaySecretKey: process.env.IYZIPAY_SECRET_KEY ?? '',
    });

    if (!productionResult.success) {
      const message = productionResult.error.issues.map((issue) => issue.message).join('; ');
      throw new Error(message);
    }

    if (env.allowedOrigins.length === 0) {
      throw new Error('Production ortamında CORS_ORIGINS veya FRONTEND_URL tanımlanmalı');
    }
  }
};
