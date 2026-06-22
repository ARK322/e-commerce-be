import { CommerceError } from '@/shared/errors/commerce-error';
import type { OrderStatus } from '@/integrations/mongo';

export const ITEM_FULFILLMENT_STATUSES = ['pending', 'shipped', 'delivered'] as const;
export type ItemFulfillmentStatus = (typeof ITEM_FULFILLMENT_STATUSES)[number];

type OrderItemWithFulfillment = {
  sellerId: string;
  fulfillmentStatus?: ItemFulfillmentStatus | null;
};

export const assertSellerItemStatusTransition = (
  currentStatus: ItemFulfillmentStatus,
  nextStatus: 'shipped' | 'delivered'
) => {
  if (nextStatus === 'shipped' && currentStatus !== 'pending') {
    throw new CommerceError(400, 'Sipariş kalemi yalnızca pending iken shipped yapılabilir');
  }

  if (nextStatus === 'delivered' && currentStatus !== 'shipped') {
    throw new CommerceError(400, 'Sipariş kalemi yalnızca shipped iken delivered yapılabilir');
  }
};

export const computeAggregateOrderStatus = (
  items: OrderItemWithFulfillment[]
): OrderStatus => {
  const statuses = items.map((item) => item.fulfillmentStatus ?? 'pending');

  if (statuses.every((status) => status === 'delivered')) {
    return 'delivered';
  }

  if (statuses.every((status) => status === 'shipped' || status === 'delivered')) {
    return 'shipped';
  }

  return 'paid';
};

export const computeSellerSubtotal = (
  items: Array<{ sellerId: string; subtotal: number }>,
  sellerId: string
): number =>
  items.filter((item) => item.sellerId === sellerId).reduce((sum, item) => sum + item.subtotal, 0);
