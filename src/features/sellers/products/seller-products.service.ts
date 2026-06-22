import type { FastifyRequest } from 'fastify';
import { parseCreateProductRequest } from '@/domain/catalog/product/parse-create-product-request';
import { createProductSchema } from '@/domain/catalog/product/product-seller.schema';
import {
  addProductImage,
  createProductWithImages,
  deleteProduct,
  listSellerProducts,
  removeProductImage,
  updateProduct,
} from '@/domain/catalog/product/seller-products';

export {
  addProductImage,
  createProduct,
  createProductWithImages,
  deleteProduct,
  listSellerProducts,
  removeProductImage,
  updateProduct,
} from '@/domain/catalog/product/seller-products';

export const createProductFromRequest = async (sellerId: string, request: FastifyRequest) => {
  const { input, images } = await parseCreateProductRequest(request, createProductSchema);
  const product = await createProductWithImages(sellerId, input, images);

  return { product, imageCount: images.length };
};
