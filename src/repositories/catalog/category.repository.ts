import { Category } from '@/infrastructure/mongo';

export const findAllCategoryGraphNodesLean = async () =>
  Category.find().select('_id parentIds childIds isActive isLeaf').lean();

export const findCategoryById = async (categoryId: string) => Category.findById(categoryId);

export const findCategoryByIdLean = async (categoryId: string) =>
  Category.findById(categoryId).lean();

export const findCategoryByIdSelectLean = async (categoryId: string, select: string) =>
  Category.findById(categoryId).select(select).lean();

export const findAllCategoriesLean = async () => Category.find().lean();

export const findActiveCategoriesLean = async () => Category.find({ isActive: true }).lean();

export const createCategory = async (data: Record<string, unknown>) => Category.create(data);

export const saveCategoryDocument = async (category: { save: () => Promise<unknown> }) =>
  category.save();

export const updateCategoriesByIds = async (categoryIds: string[], update: Record<string, unknown>) =>
  Category.updateMany({ _id: { $in: categoryIds } }, { $set: update });

export const deleteCategoryById = async (categoryId: string) =>
  Category.findByIdAndDelete(categoryId);
