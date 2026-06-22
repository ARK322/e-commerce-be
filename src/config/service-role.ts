/**
 * Faz 1+ servis ayrımı: tek kod tabanı, çoklu process rolü.
 * SERVICE_ROLE env değişkeni hangi process'in hangi route/scheduler setini
 * çalıştıracağını belirler. Varsayılan `monolith` — tüm sorumluluklar tek pod'da.
 */
export const SERVICE_ROLES = [
  'monolith',
  'api',
  'notification-worker',
  'payments-worker',
  'catalog',
  'identity',
  'commerce',
  'payments',
] as const;

export type ServiceRole = (typeof SERVICE_ROLES)[number];

export const getServiceRole = (): ServiceRole => {
  const raw = process.env.SERVICE_ROLE?.trim().toLowerCase();

  if (!raw) {
    return 'monolith';
  }

  if ((SERVICE_ROLES as readonly string[]).includes(raw)) {
    return raw as ServiceRole;
  }

  throw new Error(
    `SERVICE_ROLE geçersiz: "${raw}". İzin verilenler: ${SERVICE_ROLES.join(', ')}`
  );
};

/** API trafiğine bakan (HTTP route serve eden) roller. */
export const isHttpServingRole = (role: ServiceRole): boolean =>
  role === 'monolith' ||
  role === 'api' ||
  role === 'catalog' ||
  role === 'identity' ||
  role === 'commerce' ||
  role === 'payments';

/** Arka plan worker'ı (HTTP serve etmeyen) roller. */
export const isWorkerRole = (role: ServiceRole): boolean =>
  role === 'notification-worker' || role === 'payments-worker';
