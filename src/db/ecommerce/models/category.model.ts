import { Schema, model } from 'mongoose';

const stringField = { type: String, trim: true, maxlength: 500 };

const categorySchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { ...stringField, required: true, maxlength: 200 },
    slug: { ...stringField, required: true, maxlength: 200, lowercase: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ isActive: 1, sortOrder: 1 });

export const Category = model('Category', categorySchema);
