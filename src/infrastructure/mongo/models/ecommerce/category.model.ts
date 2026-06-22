import { Schema, model } from 'mongoose';

const stringField = { type: String, trim: true, maxlength: 500 };

const categorySchema = new Schema(
  {
    _id: { type: String, required: true },
    parentIds: { type: [String], default: [] },
    childIds: { type: [String], default: [] },
    name: { ...stringField, required: true, maxlength: 200 },
    slug: { ...stringField, required: true, maxlength: 200, lowercase: true },
    isActive: { type: Boolean, default: true },
    isLeaf: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentIds: 1 });
categorySchema.index({ childIds: 1 });
categorySchema.index({ isActive: 1, isLeaf: 1 });

export const Category = model('Category', categorySchema);
