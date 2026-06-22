import { buildGateway } from '@/gateway/server';

/**
 * Faz 3 / Aşama 3 — Gateway entrypoint.
 *
 * İzole bir reverse-proxy süreci: RS256 token'ı public key ile doğrular,
 * imzalı X-User-* header'larını downstream'e basar ve Strangler-Fig routing
 * tablosuna göre catalog/identity/monolit upstream'lerine yönlendirir.
 */
const start = async (): Promise<void> => {
  const port = Number(process.env.GATEWAY_PORT ?? process.env.PORT ?? 8080);

  const app = await buildGateway();

  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error, 'gateway başlatılamadı');
    process.exit(1);
  }
};

void start();
