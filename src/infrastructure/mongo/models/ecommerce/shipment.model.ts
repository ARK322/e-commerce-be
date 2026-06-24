import { Schema, model } from 'mongoose';

export const SHIPMENT_CARRIERS = [
  'yurtici',
  'aras',
  'mng',
  'ptt',
  'ups',
  'dhl',
  'other',
] as const;
export type ShipmentCarrier = (typeof SHIPMENT_CARRIERS)[number];

export const SHIPMENT_STATUSES = ['created', 'in_transit', 'delivered', 'exception'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

const stringField = { type: String, trim: true, maxlength: 500 };

const shipmentSchema = new Schema(
  {
    _id: { type: String, required: true },
    orderId: { type: String, required: true, index: true },
    sellerId: { type: String, required: true, index: true },
    productIds: { type: [String], required: true, default: [] },
    trackingNumber: { ...stringField, required: true, maxlength: 100 },
    carrier: { type: String, enum: SHIPMENT_CARRIERS, required: true },
    status: { type: String, enum: SHIPMENT_STATUSES, default: 'created' },
    notes: { ...stringField, maxlength: 1000 },
    shippedAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

shipmentSchema.index({ orderId: 1, sellerId: 1 });
shipmentSchema.index({ trackingNumber: 1 });

export const Shipment = model('Shipment', shipmentSchema);
