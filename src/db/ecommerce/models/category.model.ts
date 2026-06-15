import { Schema, model } from 'mongoose';

const stringField = { type: String, trim: true, maxlength: 500 };

const categorySchema = new Schema(
  {
    _id: { type: String, required: true },
    parentId: { type: String, ref: 'Category', default: null },
    name: { ...stringField, required: true, maxlength: 200 },
    slug: { ...stringField, required: true, maxlength: 200, lowercase: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentId: 1 });
categorySchema.index({ isActive: 1, parentId: 1 });

export const Category = model('Category', categorySchema);
