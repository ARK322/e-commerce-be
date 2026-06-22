import { Schema, model } from 'mongoose';

export const SELLER_SYSTEM_OWNER_ROLE_SLUG = 'owner';

const stringField = { type: String, trim: true, maxlength: 500 };

const sellerRoleSchema = new Schema(
  {
    _id: { type: String, required: true },
    sellerId: { type: String, ref: 'Seller', required: true },
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

sellerRoleSchema.index({ sellerId: 1, slug: 1 }, { unique: true });
sellerRoleSchema.index({ sellerId: 1, isSystem: 1 });

export const SellerRole = model('SellerRole', sellerRoleSchema);
