import { Schema, model } from 'mongoose';

export const SYSTEM_OWNER_ROLE_SLUG = 'owner';

const stringField = { type: String, trim: true, maxlength: 500 };

const adminRoleSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { ...stringField, required: true, maxlength: 100 },
    slug: { ...stringField, required: true, maxlength: 100, lowercase: true },
    description: { ...stringField, maxlength: 1000, default: null },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
    createdBy: { type: String, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

adminRoleSchema.index({ slug: 1 }, { unique: true });
adminRoleSchema.index({ isSystem: 1 });

export const AdminRole = model('AdminRole', adminRoleSchema);
