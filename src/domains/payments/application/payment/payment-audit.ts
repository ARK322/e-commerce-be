import type { PaymentStatus } from '@/integrations/mongo';
import { createUserId } from '@/shared/ids';
import { createLogger } from '@/shared/logging';
import { createPaymentAuditLog } from '@/domains/payments/infrastructure/repositories/payment-audit-log.repository';

const log = createLogger({ module: 'payment-audit' });

type PaymentTransitionInput = {
  paymentId: string;
  orderId: string;
  from: PaymentStatus;
  to: PaymentStatus;
  reason: string;
  metadata?: Record<string, unknown>;
};

export const logPaymentTransition = (input: PaymentTransitionInput): void => {
  log.info(
    {
      paymentId: input.paymentId,
      orderId: input.orderId,
      from: input.from,
      to: input.to,
      reason: input.reason,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
    'Payment status transitioned'
  );

  void createPaymentAuditLog({
    _id: createUserId(),
    paymentId: input.paymentId,
    orderId: input.orderId,
    fromStatus: input.from,
    toStatus: input.to,
    reason: input.reason,
    metadata: input.metadata ?? null,
  }).catch((error) => {
    log.error({ err: error, orderId: input.orderId }, 'Payment audit log yazılamadı');
  });
};
