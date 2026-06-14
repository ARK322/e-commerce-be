import { Schema, model } from 'mongoose';

const cartItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    priceSnapshot: { type: Number, min: 0, default: null },
  },
  { _id: false, strict: true }
);

const cartSchema = new Schema(
  {
    _id: { type: String, required: true },
    items: { type: [cartItemSchema], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

cartSchema.index({ 'items.productId': 1 });

export const Cart = model('Cart', cartSchema);
