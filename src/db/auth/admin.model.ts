import { Schema, model, Types } from 'mongoose';

export const ADMIN_ROLES = ['owner', 'helper'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const adminSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
    adminRole: { type: String, enum: ADMIN_ROLES, required: true },
    createdBy: { type: Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

adminSchema.index({ adminRole: 1 });

export const Admin = model('Admin', adminSchema);
