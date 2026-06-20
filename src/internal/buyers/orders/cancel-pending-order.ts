import { Order } from '@/integrations/mongo';

export const cancelPendingOrder = async (orderId: string): Promise<boolean> => {
  const result = await Order.updateOne(
    { _id: orderId, status: 'pending' },
    { $set: { status: 'cancelled', updatedAt: new Date() } }
  );

  return (result.modifiedCount ?? 0) > 0;
};
