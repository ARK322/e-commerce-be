import { CommerceError } from '@/shared/errors/commerce-error';
import { isCategoryPubliclyVisible } from '@/domains/catalog/application/category/visible-categories';
import { findActiveCatalogProductLean } from '@/domains/catalog/infrastructure/repositories/product.repository';

export const findPurchasableCatalogProductLean = async (productId: string) => {
  const product = await findActiveCatalogProductLean(productId);

  if (!product?.categoryId) {
    return null;
  }

  const visible = await isCategoryPubliclyVisible(String(product.categoryId));

  if (!visible) {
    return null;
  }

  return product;
};

export const assertPurchasableCatalogProduct = async (productId: string) => {
  const product = await findPurchasableCatalogProductLean(productId);

  if (!product) {
    throw new CommerceError(404, 'Ürün bulunamadı');
  }

  return product;
};
