/**
 * Faz 3 / Aşama 3 — Strangler-Fig routing tablosu.
 *
 * Gateway gelen isteğin path'ine bakar:
 *  - Taşınmış (migrated) rotalar → ilgili mikroservis container'ına proxy'lenir.
 *  - Taşınmamış rotalar → eski monolit'e (fallback) dokunulmadan paslanır.
 *
 * Upstream adresleri env ile override edilebilir; lokal docker-compose için
 * mantıklı default'lar verilmiştir.
 */
export type GatewayUpstreams = {
  catalog: string;
  identity: string;
  monolith: string;
};

export type GatewayRoute = {
  /** Eşleşme yapılacak path öneki. */
  prefix: string;
  /** Hedef upstream anahtarı. */
  target: keyof GatewayUpstreams;
  /** true → ayrı mikroservise taşındı; false → monolit fallback. */
  migrated: boolean;
};

export const resolveUpstreams = (
  source: NodeJS.ProcessEnv = process.env
): GatewayUpstreams => {
  const monolith = source.GATEWAY_MONOLITH_UPSTREAM?.trim() || 'http://api:3000';

  return {
    monolith,
    // Taşınmamış servisler için default olarak monolit'e düşeriz (zero-downtime).
    catalog: source.GATEWAY_CATALOG_UPSTREAM?.trim() || monolith,
    identity: source.GATEWAY_IDENTITY_UPSTREAM?.trim() || monolith,
  };
};

/**
 * Sıralı eşleşme — ilk uyan prefix kazanır. En spesifik/taşınmış rotalar üstte,
 * genel fallback (`/`) en sonda olmalı.
 */
export const GATEWAY_ROUTES: GatewayRoute[] = [
  { prefix: '/auth', target: 'identity', migrated: true },
  { prefix: '/products', target: 'catalog', migrated: true },
  { prefix: '/categories', target: 'catalog', migrated: true },
  // Henüz taşınmamış commerce rotaları (cart/orders/payments/support) → monolit.
  { prefix: '/', target: 'monolith', migrated: false },
];

const normalizePath = (rawUrl: string): string => {
  const path = rawUrl.split('?')[0] ?? '/';
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
};

const matchesPrefix = (path: string, prefix: string): boolean => {
  if (prefix === '/') {
    return true;
  }

  return path === prefix || path.startsWith(`${prefix}/`);
};

export type RouteResolution = {
  route: GatewayRoute;
  upstream: string;
};

export const resolveRoute = (
  rawUrl: string,
  upstreams: GatewayUpstreams,
  routes: GatewayRoute[] = GATEWAY_ROUTES
): RouteResolution => {
  const path = normalizePath(rawUrl);
  const route = routes.find((candidate) => matchesPrefix(path, candidate.prefix)) ?? routes[routes.length - 1];

  return { route, upstream: upstreams[route.target] };
};
