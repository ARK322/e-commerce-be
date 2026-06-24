import { CommerceError } from '@/shared/errors/commerce-error';

type OrderItemForRefund = {
  productId: string;
  quantity: number;
  subtotal: number;
};

type ReturnItemForRefund = {
  productId: string;
  quantity: number;
};

type PaymentForRefund = {
  amount: number;
  refundedAmount?: number | null;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const calculateReturnRefundAmount = (
  order: { items: OrderItemForRefund[]; totalAmount: number },
  returnItems: ReturnItemForRefund[],
  type: 'cancellation' | 'return',
  payment: PaymentForRefund
): number => {
  const alreadyRefunded = payment.refundedAmount ?? 0;
  const remainingRefundable = roundMoney(Math.max(0, payment.amount - alreadyRefunded));

  if (remainingRefundable <= 0) {
    throw new CommerceError(400, 'Bu ödeme için iade edilebilir tutar kalmadı');
  }

  if (type === 'cancellation') {
    return remainingRefundable;
  }

  let requestedRefund = 0;

  for (const returnItem of returnItems) {
    const orderItem = order.items.find((entry) => entry.productId === returnItem.productId);

    if (!orderItem) {
      throw new CommerceError(400, 'Geçersiz sipariş kalemi');
    }

    if (returnItem.quantity > orderItem.quantity) {
      throw new CommerceError(400, 'Geçersiz iade adedi');
    }

    const unitPrice = orderItem.subtotal / orderItem.quantity;
    requestedRefund += unitPrice * returnItem.quantity;
  }

  requestedRefund = roundMoney(requestedRefund);

  if (requestedRefund <= 0) {
    throw new CommerceError(400, 'İade tutarı hesaplanamadı');
  }

  if (requestedRefund > remainingRefundable + 0.001) {
    throw new CommerceError(400, 'İade tutarı kalan ödeme tutarını aşıyor');
  }

  return requestedRefund;
};

export const isFullOrderReturn = (
  orderItems: OrderItemForRefund[],
  returnItems: ReturnItemForRefund[]
) => {
  if (returnItems.length !== orderItems.length) {
    return false;
  }

  return orderItems.every((orderItem) => {
    const returnItem = returnItems.find((entry) => entry.productId === orderItem.productId);
    return returnItem && returnItem.quantity >= orderItem.quantity;
  });
};
