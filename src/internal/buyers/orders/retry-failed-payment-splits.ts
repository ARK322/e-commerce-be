import { createLogger } from '@/internal/common/logging';
import { enqueueOpsAlert } from '@/internal/common/outbox/ops-alert';
import { OUTBOX_EVENT_TYPES } from '@/internal/common/outbox/enqueue-outbox-event';
import { approvePaymentSplitsForSeller } from '@/internal/buyers/payment/payment-split';
import { findOrderByIdLean } from '@/repositories/buyers/order.repository';
import {
  listRetryablePaymentSplitGroupsLean,
  resetFailedPaymentSplitsToPending,
} from '@/repositories/buyers/payment-split.repository';

const log = createLogger({ module: 'retry-payment-splits' });

const isSellerDeliveryComplete = (
  order: {
    items: Array<{ sellerId: string; fulfillmentStatus?: string | null }>;
  },
  sellerId: string
) =>
  order.items
    .filter((item) => item.sellerId === sellerId)
    .every((item) => item.fulfillmentStatus === 'delivered');

export const retryFailedPaymentSplitApprovals = async (): Promise<number> => {
  const groups = await listRetryablePaymentSplitGroupsLean();
  let handled = 0;

  for (const group of groups) {
    const order = await findOrderByIdLean(group.orderId);

    if (!order || !isSellerDeliveryComplete(order, group.sellerId)) {
      continue;
    }

    try {
      await resetFailedPaymentSplitsToPending(group.orderId, group.sellerId);
      await approvePaymentSplitsForSeller(group.orderId, group.sellerId);
      handled += 1;
    } catch (error) {
      log.warn(
        { err: error, orderId: group.orderId, sellerId: group.sellerId },
        'Split onay yeniden denemesi başarısız'
      );
      await enqueueOpsAlert(OUTBOX_EVENT_TYPES.OPS_PAYMENT_SPLIT_APPROVAL_FAILED, {
        orderId: group.orderId,
        sellerId: group.sellerId,
        source: 'retry_scheduler',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return handled;
};

export const startPaymentSplitApprovalRetryScheduler = (): void => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const run = () => {
    void retryFailedPaymentSplitApprovals().catch((err) => {
      log.error({ err }, 'Split onay yeniden deneme işi başarısız');
    });
  };

  run();
  setInterval(run, 5 * 60_000);
};
