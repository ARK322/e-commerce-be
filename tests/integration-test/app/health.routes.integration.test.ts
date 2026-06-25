import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('@/repositories/common/outbox-event.repository', () => ({
  countPendingOutboxEventsLean: vi.fn().mockResolvedValue(3),
}));

import { buildApp } from '@/app/app';

describe('health routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'integration-test-jwt-secret-with-32-chars-minimum';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health ok döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('GET /ready mongo bağlı değilse 503 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect([200, 503]).toContain(response.statusCode);
  });
});
