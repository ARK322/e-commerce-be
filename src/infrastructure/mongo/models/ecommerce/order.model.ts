import { Schema, model } from 'mongoose';

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_CURRENCIES = ['TRY'] as const;
export type OrderCurrency = (typeof ORDER_CURRENCIES)[number];

export const ITEM_FULFILLMENT_STATUSES = ['pending', 'shipped', 'delivered'] as const;
export type ItemFulfillmentStatus = (typeof ITEM_FULFILLMENT_STATUSES)[number];

const stringField = { type: String, trim: true, maxlength: 500 };

const orderItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    sellerId: { type: String, required: true },
    name: { ...stringField, required: true, maxlength: 200 },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
    fulfillmentStatus: {
      type: String,
      enum: ITEM_FULFILLMENT_STATUSES,
      default: 'pending',
    },
  },
  { _id: false, strict: true }
);

const shippingAddressSchema = new Schema(
  {
    firstName: { ...stringField, maxlength: 100 },
    lastName: { ...stringField, maxlength: 100 },
    phone: { ...stringField, maxlength: 20 },
    country: { ...stringField, maxlength: 100 },
    city: { ...stringField, maxlength: 100 },
    address: { ...stringField, maxlength: 1000 },
  },
  { _id: false, strict: true }
);

const orderSchema = new Schema(
  {
    _id: { type: String, required: true },
    buyerId: { type: String, required: true },
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ORDER_CURRENCIES, default: 'TRY' },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    stockReserved: { type: Boolean, default: false },
    stockReservedAt: { type: Date, default: null },
    shippingAddress: { type: shippingAddressSchema, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'items.sellerId': 1, createdAt: -1 });

export const Order = model('Order', orderSchema);
