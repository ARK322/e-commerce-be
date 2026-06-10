import { Schema, model, Types } from 'mongoose';

const stringField = { type: String, trim: true, maxlength: 500 };

const buyerSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
    firstName: stringField,
    lastName: stringField,
    phone: { ...stringField, maxlength: 20 },
    country: stringField,
    city: stringField,
    nationalId: { ...stringField, maxlength: 11 },
    deliveryAddress: { ...stringField, maxlength: 1000 },
    corporateAddress: { ...stringField, maxlength: 1000 },
    billingAddress: { ...stringField, maxlength: 1000 },
    billingSameAsDelivery: { type: Boolean, default: false },
  },
  { strict: true }
);

export const Buyer = model('Buyer', buyerSchema);
