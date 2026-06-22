import Fastify, { type FastifyInstance } from 'fastify';
import replyFrom from '@fastify/reply-from';
import jwt from 'jsonwebtoken';
import type { IncomingHttpHeaders } from 'node:http';
import { verifyAuthToken } from '@/domains/identity/application/tokens/access-token';
import { isAccessRevoked } from '@/domains/identity/application/tokens/revocation-registry';
import { GATEWAY_HEADERS, signGatewayHeaders } from '@/shared/security/gateway-signature';
import { resolveRoute, resolveUpstreams, type GatewayUpstreams } from '@/gateway/route-table';

type MutableHeaders = Record<string, string | string[] | undefined>;

/**
 * Client'tan gelebilecek sahte gateway header'larını temizler. Kullanıcı,
 * gateway üzerinden de geçse manuel X-User-Role: admin enjekte edememeli;
 * yalnızca gateway'in kendi imzaladığı header'lar downstream'e ulaşır.
 */
const stripUntrustedGatewayHeaders = (headers: MutableHeaders): void => {
  for (const name of Object.values(GATEWAY_HEADERS)) {
    delete headers[name];
  }
};

export type BuildGatewayOptions = {
  upstreams?: GatewayUpstreams;
  signingSecret?: string;
  logLevel?: string;
};

export const buildGateway = async (
  options: BuildGatewayOptions = {}
): Promise<FastifyInstance> => {
  const upstreams = options.upstreams ?? resolveUpstreams();
  const signingSecret = options.signingSecret ?? process.env.GATEWAY_SIGNING_SECRET?.trim();

  const app = Fastify({
    logger: { level: options.logLevel ?? process.env.LOG_LEVEL ?? 'info' },
    trustProxy: true,
    disableRequestLogging: true,
  });

  await app.register(replyFrom);

  app.get('/__gateway/health', async () => ({
    status: 'ok',
    signing: signingSecret ? 'enabled' : 'disabled',
    upstreams,
  }));

  app.all('/*', async (request, reply) => {
    const { route, upstream } = resolveRoute(request.url, upstreams);

    // Edge'de RS256 token doğrulaması (gateway yalnızca public key'e sahiptir).
    // Doğrulanamayan / olmayan token → anonim; istek yine de proxy'lenir,
    // downstream kendi auth'una düşer (Strangler-Fig fallback).
    let identity: { userId: string; role: string; scopes: string[] } | null = null;
    const authorization = request.headers.authorization;

    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7);

      try {
        const payload = verifyAuthToken(token);

        // Dağıtık revocation: imza geçerli olsa da ban/şifre-değişimi/logout
        // sonrası token Redis cutoff'una takılıyorsa içeri hiç almayız.
        const issuedAtSeconds = (jwt.decode(token) as jwt.JwtPayload | null)?.iat;
        const revoked = await isAccessRevoked({
          token,
          userId: payload.userId,
          issuedAtSeconds,
        });

        if (revoked) {
          request.log.info({ userId: payload.userId }, 'gateway.revoked');
          return reply
            .status(401)
            .send({ message: 'Oturum sonlandırıldı, tekrar giriş yapın' });
        }

        identity = {
          userId: payload.userId,
          role: payload.role,
          scopes: payload.scopes ?? [],
        };
      } catch {
        identity = null;
      }
    }

    request.log.info(
      {
        method: request.method,
        path: request.url.split('?')[0],
        upstream,
        target: route.target,
        migrated: route.migrated,
        userId: identity?.userId,
        role: identity?.role,
      },
      'gateway.proxy'
    );

    return reply.from(`${upstream}${request.url}`, {
      rewriteRequestHeaders: (_req, headers: IncomingHttpHeaders) => {
        const mutable = headers as MutableHeaders;
        // undici upstream'i "Expect: 100-continue" header'ını desteklemez.
        delete mutable.expect;
        stripUntrustedGatewayHeaders(mutable);

        if (identity && signingSecret) {
          const signed = signGatewayHeaders(identity, signingSecret);
          mutable[GATEWAY_HEADERS.userId] = signed.userId;
          mutable[GATEWAY_HEADERS.role] = signed.role;
          mutable[GATEWAY_HEADERS.scopes] = signed.scopes;
          mutable[GATEWAY_HEADERS.timestamp] = signed.timestamp;
          mutable[GATEWAY_HEADERS.signature] = signed.signature;
        }

        return headers;
      },
    });
  });

  return app;
};
