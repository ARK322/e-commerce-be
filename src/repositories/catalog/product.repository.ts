import { Product } from '@/integrations/mongo';

export const findActiveCatalogProductLean = async (productId: string) =>
  Product.findOne({
    _id: productId,
    isActive: true,
    categoryId: { $ne: null },
  }).lean();

export const findActiveProductLean = async (productId: string) =>
  Product.findOne({
    _id: productId,
    isActive: true,
  }).lean();

export const findProductSummariesByIdsLean = async (productIds: string[]) => {
  if (productIds.length === 0) {
    return [];
  }

  return Product.find({ _id: { $in: productIds } })
    .select('name price stock minOrderQuantity isActive images')
    .lean();
};

export const findProductById = async (productId: string) => Product.findById(productId);

export const findPublicActiveProductLean = async (productId: string) =>
  Product.findOne({
    _id: productId,
    isActive: true,
    categoryId: { $ne: null },
  }).lean();

export const listProductsLean = async (
  filter: Record<string, unknown>,
  options: { skip: number; limit: number }
) =>
  Product.find(filter)
    .sort({ createdAt: -1 })
    .skip(options.skip)
    .limit(options.limit)
    .lean();

export const countProducts = async (filter: Record<string, unknown>) =>
  Product.countDocuments(filter);

export const listSellerProductsLean = async (sellerId: string) =>
  Product.find({ sellerId }).sort({ createdAt: -1 }).lean();

export const createProduct = async (data: Record<string, unknown>) => Product.create(data);

export const saveProductDocument = async (product: {
  updatedAt?: Date;
  save: () => Promise<unknown>;
}) => {
  product.updatedAt = new Date();
  await product.save();
};

export const deleteProductById = async (productId: string) => Product.findByIdAndDelete(productId);

export const clearProductsInCategory = async (categoryId: string) =>
  Product.updateMany({ categoryId }, { $set: { categoryId: null } });

export const deactivateProductsInCategories = async (categoryIds: string[]) =>
  Product.updateMany({ categoryId: { $in: categoryIds } }, { $set: { isActive: false } });

export const countProductsInCategory = async (categoryId: string) =>
  Product.countDocuments({ categoryId });
