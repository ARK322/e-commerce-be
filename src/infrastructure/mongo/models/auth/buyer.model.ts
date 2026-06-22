import { Schema, model } from 'mongoose';

const stringField = { type: String, trim: true, maxlength: 500 };

const buyerSchema = new Schema(
  {
    _id: { type: String, required: true },
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
