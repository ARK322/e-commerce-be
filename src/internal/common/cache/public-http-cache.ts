import type { FastifyReply } from 'fastify';

export const PUBLIC_HTTP_CACHE = {
  categories: 'public, max-age=60, stale-while-revalidate=120',
  productsList: 'public, max-age=30, stale-while-revalidate=60',
  productDetail: 'public, max-age=60, stale-while-revalidate=120',
} as const;

export type PublicHttpCachePreset = keyof typeof PUBLIC_HTTP_CACHE;

export const setPublicCacheControl = (
  reply: FastifyReply,
  preset: PublicHttpCachePreset
): void => {
  reply.header('Cache-Control', PUBLIC_HTTP_CACHE[preset]);
};
