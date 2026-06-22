import { Schema, model } from 'mongoose';

const stringField = { type: String, trim: true, maxlength: 500 };

const sellerMemberSchema = new Schema(
  {
    _id: { type: String, required: true },
    sellerId: { type: String, ref: 'Seller', required: true },
    roleId: { type: String, ref: 'SellerRole', required: true },
    isOwner: { type: Boolean, default: false },
    firstName: stringField,
    lastName: stringField,
    phone: { ...stringField, maxlength: 20 },
    createdBy: { type: String, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

sellerMemberSchema.index({ sellerId: 1 });
sellerMemberSchema.index({ sellerId: 1, isOwner: 1 });
sellerMemberSchema.index({ roleId: 1 });

export const SellerMember = model('SellerMember', sellerMemberSchema);
