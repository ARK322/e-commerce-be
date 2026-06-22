import '../helpers/mocks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '@/app/app';
import { buildGateway } from '@/gateway/server';
import { GATEWAY_HEADERS } from '@/shared/security/gateway-signature';
import { closeRedis } from '@/integrations/redis/redis';
import { ensureE2EEnv, getE2EMongoUri, isE2EEnabled } from '../helpers/env';
import { loginUser, registerBuyer, verifyUserEmail } from '../helpers/fixtures';

const describeE2E = isE2EEnabled() ? describe : describe.skip;

const SIGNING_SECRET = 'e2e-gateway-trust-secret';

// Test 3 (instant revocation) gateway-edge'de Redis gerektirir. Redis yoksa
// (lokal e2e), bu senaryo skip edilir; CI'da E2E_REDIS_URL/REDIS_URL sağlanır.
const revocationEnabled = Boolean(
  process.env.E2E_REDIS_URL?.trim() || process.env.REDIS_URL?.trim()
);
const itRevocation = revocationEnabled ? it : it.skip;

const addressUrl = (app: FastifyInstance): string => {
  const address = app.server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
};

type EnvSnapshot = Record<string, string | undefined>;

const snapshotEnv = (keys: string[]): EnvSnapshot =>
  Object.fromEntries(keys.map((key) => [key, process.env[key]]));

const restoreEnv = (snapshot: EnvSnapshot): void => {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

describeE2E('gateway security (E2E)', () => {
  let monolith: FastifyInstance;
  let gateway: FastifyInstance;
  let monolithUrl: string;
  let gatewayUrl: string;
  let envSnapshot: EnvSnapshot;

  beforeAll(async () => {
    ensureE2EEnv();

    envSnapshot = snapshotEnv([
      'JWT_PRIVATE_KEY',
      'JWT_PUBLIC_KEY',
      'GATEWAY_SIGNING_SECRET',
      'REDIS_URL',
    ]);

    // Ephemeral RS256 anahtar çifti → login RS256 imzalar, gateway public ile doğrular.
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    process.env.JWT_PRIVATE_KEY = privateKey;
    process.env.JWT_PUBLIC_KEY = publicKey;
    process.env.GATEWAY_SIGNING_SECRET = SIGNING_SECRET;

    if (revocationEnabled) {
      process.env.REDIS_URL =
        process.env.E2E_REDIS_URL?.trim() || process.env.REDIS_URL?.trim();
    }

    const mongoUri = getE2EMongoUri();
    if (!mongoUri) {
      throw new Error('E2E_MONGO_URI veya MONGO_URI tanımlı olmalı');
    }
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    monolith = await buildApp();
    await monolith.listen({ port: 0, host: '127.0.0.1' });
    monolithUrl = addressUrl(monolith);

    gateway = await buildGateway({
      signingSecret: SIGNING_SECRET,
      upstreams: { monolith: monolithUrl, identity: monolithUrl, catalog: monolithUrl },
      logLevel: 'silent',
    });
    await gateway.listen({ port: 0, host: '127.0.0.1' });
    gatewayUrl = addressUrl(gateway);
  });

  afterAll(async () => {
    await gateway?.close();
    await monolith?.close();

    if (revocationEnabled) {
      await closeRedis();
    }

    if (mongoose.connection.readyState !== 0 && mongoose.connection.db) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }

    restoreEnv(envSnapshot);
  });

  it('Test 1 — alt servise imzasız sahte admin header\'ı 401 ile reddedilir (spoofing)', async () => {
    const response = await fetch(`${monolithUrl}/auth/me`, {
      headers: {
        [GATEWAY_HEADERS.userId]: 'attacker',
        [GATEWAY_HEADERS.role]: 'admin',
        [GATEWAY_HEADERS.scopes]: '*',
      },
    });

    expect(response.status).toBe(401);
  });

  it('Test 2 — gateway üzerinden geçerli RS256 token ile 200 ve downstream içeriği okur', async () => {
    const { email, password, userId } = await registerBuyer(monolith);
    await verifyUserEmail(monolith, userId);
    const token = await loginUser(monolith, email, password);

    const response = await fetch(`${gatewayUrl}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { email: string; role: string };
    expect(body).toMatchObject({ email, role: 'buyer' });
  });

  itRevocation(
    'Test 3 — /auth/logout sonrası aynı token gateway edge\'de anında 401 olur (instant revocation)',
    async () => {
      const { email, password, userId } = await registerBuyer(monolith);
      await verifyUserEmail(monolith, userId);
      const token = await loginUser(monolith, email, password);

      const before = await fetch(`${gatewayUrl}/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(before.status).toBe(200);

      const logout = await fetch(`${gatewayUrl}/auth/logout`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: '{}',
      });
      expect(logout.status).toBe(200);

      const after = await fetch(`${gatewayUrl}/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(after.status).toBe(401);
    }
  );
});
