const DEFAULT_DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:5173'];

export const getAllowedOrigins = (): string[] => {
  const raw = process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL;

  if (raw?.trim()) {
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  return DEFAULT_DEV_ORIGINS;
};

export const corsOriginHandler = (
  origin: string | undefined,
  callback: (err: Error | null, allow: boolean) => void
) => {
  const allowed = getAllowedOrigins();

  if (!origin || allowed.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('CORS: origin izinli değil'), false);
};
