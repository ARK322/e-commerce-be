import type { ShipmentCarrier } from '@/infrastructure/mongo';
import { Shipment } from '@/infrastructure/mongo';

export type CreateShipmentData = {
  _id: string;
  orderId: string;
  sellerId: string;
  productIds: string[];
  trackingNumber: string;
  carrier: ShipmentCarrier;
  notes?: string | null;
};

export const createShipment = async (data: CreateShipmentData) => Shipment.create(data);

export const listShipmentsByOrderIdLean = async (orderId: string) =>
  Shipment.find({ orderId }).sort({ createdAt: 1 }).lean();

export const listShipmentsByOrderAndSellerLean = async (orderId: string, sellerId: string) =>
  Shipment.find({ orderId, sellerId }).sort({ createdAt: 1 }).lean();

export const findShipmentByIdLean = async (shipmentId: string) =>
  Shipment.findById(shipmentId).lean();

export const updateShipmentStatus = async (
  shipmentId: string,
  status: string,
  deliveredAt?: Date | null
) =>
  Shipment.findByIdAndUpdate(
    shipmentId,
    {
      $set: {
        status,
        ...(deliveredAt !== undefined ? { deliveredAt } : {}),
        updatedAt: new Date(),
      },
    },
    { new: true }
  );
