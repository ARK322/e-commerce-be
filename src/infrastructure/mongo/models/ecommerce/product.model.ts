import { Schema, model } from 'mongoose';

export const PRODUCT_CURRENCIES = ['TRY'] as const;
export type ProductCurrency = (typeof PRODUCT_CURRENCIES)[number];

const stringField = { type: String, trim: true, maxlength: 500 };
const urlField = { type: String, trim: true, maxlength: 2048 };

const productSchema = new Schema(
  {
    _id: { type: String, required: true },
    sellerId: { type: String, required: true },
    categoryId: { type: String, default: null },
    name: { ...stringField, required: true, maxlength: 200 },
    slug: { ...stringField, maxlength: 200, lowercase: true, default: null },
    description: { ...stringField, maxlength: 5000, default: null },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: PRODUCT_CURRENCIES, default: 'TRY' },
    stock: { type: Number, required: true, min: 0, default: 0 },
    minOrderQuantity: { type: Number, required: true, min: 1, default: 1 },
    isActive: { type: Boolean, default: true },
    images: { type: [urlField], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

productSchema.index({ sellerId: 1, createdAt: -1 });
productSchema.index({ categoryId: 1, isActive: 1 });
productSchema.index({ slug: 1 }, { unique: true, sparse: true });

export const Product = model('Product', productSchema);
