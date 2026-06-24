import { Schema, model } from 'mongoose';

const stringField = { type: String, trim: true, maxlength: 500 };

const buyerAddressSchema = new Schema(
  {
    _id: { type: String, required: true },
    label: { ...stringField, maxlength: 100 },
    firstName: { ...stringField, maxlength: 100 },
    lastName: { ...stringField, maxlength: 100 },
    phone: { ...stringField, maxlength: 20 },
    country: { ...stringField, maxlength: 100 },
    city: { ...stringField, maxlength: 100 },
    address: { ...stringField, maxlength: 1000 },
    isDefaultDelivery: { type: Boolean, default: false },
    isDefaultBilling: { type: Boolean, default: false },
  },
  { _id: false, strict: true }
);

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
    addresses: { type: [buyerAddressSchema], default: [] },
    defaultDeliveryAddressId: { type: String, default: null },
    defaultBillingAddressId: { type: String, default: null },
  },
  { strict: true }
);

export const Buyer = model('Buyer', buyerSchema);
