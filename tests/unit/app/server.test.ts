import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockConnectDB = vi.fn();
const mockBuildApp = vi.fn();
const mockListen = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@/config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/env')>();
  return {
    ...actual,
    validateEnvAtStartup: vi.fn(),
  };
});

vi.mock('@/integrations/mongo', () => ({
  connectDB: (...args: unknown[]) => mockConnectDB(...args),
}));

vi.mock('@/app/app', () => ({
  buildApp: (...args: unknown[]) => mockBuildApp(...args),
}));

vi.mock('@/domains/commerce/application/orders/expire-pending-orders', () => ({
  startPendingOrderExpiryScheduler: vi.fn(),
}));

vi.mock('@/domains/commerce/application/orders/reconcile-payments', () => ({
  startPaymentReconciliationScheduler: vi.fn(),
}));

vi.mock('@/domains/commerce/application/orders/recover-stuck-payments', () => ({
  startStuckPaymentRecoveryScheduler: vi.fn(),
}));

vi.mock('@/domains/commerce/application/orders/retry-payment-split-sync', () => ({
  startPaymentSplitSyncRetryScheduler: vi.fn(),
}));

vi.mock('@/domains/commerce/application/orders/retry-failed-payment-splits', () => ({
  startPaymentSplitApprovalRetryScheduler: vi.fn(),
}));

vi.mock('@/domains/payments/application/wallet/retry-missing-wallet-credits', () => ({
  startMissingSellerWalletCreditRetryScheduler: vi.fn(),
}));

vi.mock('@/domains/notifications/application/outbox/process-outbox-events', () => ({
  startOutboxProcessorScheduler: vi.fn(),
}));

vi.mock('@/domains/identity/application/register/expire-unverified-users', () => ({
  startUnverifiedUserExpiryScheduler: vi.fn(),
}));

vi.mock('@/shared/logging', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    fatal: vi.fn(),
  },
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { getPort, start } from '@/app/server';

describe('getPort', () => {
  const originalPort = process.env.PORT;

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  it('PORT yoksa 8080 döner', () => {
    delete process.env.PORT;
    expect(getPort()).toBe(8080);
  });

  it('PORT env değerini parse eder', () => {
    process.env.PORT = '3000';
    expect(getPort()).toBe(3000);
  });

  it('geçersiz PORT için hata fırlatır', () => {
    process.env.PORT = 'abc';
    expect(() => getPort()).toThrow('PORT geçersiz bir sayı');
  });
});

describe('start', () => {
  const originalPort = process.env.PORT;
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectDB.mockResolvedValue(undefined);
    mockListen.mockResolvedValue(undefined);
    mockBuildApp.mockResolvedValue({ listen: mockListen });
    delete process.env.PORT;
  });

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  it('connectDB, buildApp ve listen sırasıyla çağrılır', async () => {
    await start();

    expect(mockConnectDB).toHaveBeenCalledOnce();
    expect(mockBuildApp).toHaveBeenCalledOnce();
    expect(mockListen).toHaveBeenCalledWith({ port: 8080, host: '0.0.0.0' });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('başlatma hatasında process.exit(1) çağrılır', async () => {
    mockConnectDB.mockRejectedValue(new Error('db down'));

    await start();

    expect(mockLoggerError).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
