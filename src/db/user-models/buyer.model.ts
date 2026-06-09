import { Schema, model, Types } from 'mongoose';

const buyerSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
  firstName: { type: String },
  lastName: { type: String },
  phone: { type: String },
  country: { type: String },
  city: { type: String },
  nationalId: { type: String },
  deliveryAddress: { type: String },
  corporateAddress: { type: String },
  billingAddress: { type: String },
  billingSameAsDelivery: { type: Boolean, default: false },
});

export const Buyer = model('Buyer', buyerSchema);
