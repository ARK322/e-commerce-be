import { Schema, model } from 'mongoose';

const stringField = { type: String, trim: true, maxlength: 500 };

const adminSchema = new Schema(
  {
    _id: { type: String, required: true },
    roleId: { type: String, ref: 'AdminRole', required: true },
    firstName: stringField,
    lastName: stringField,
    phone: { ...stringField, maxlength: 20 },
    createdBy: { type: String, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

adminSchema.index({ roleId: 1 });

export const Admin = model('Admin', adminSchema);
