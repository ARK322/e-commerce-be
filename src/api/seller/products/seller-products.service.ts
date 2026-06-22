import type { FastifyRequest } from 'fastify';
import { parseCreateProductRequest } from '@/domains/catalog/application/product/parse-create-product-request';
import { createProductSchema } from '@/domains/catalog/application/product/product-seller.schema';
import {
  addProductImage,
  createProductWithImages,
  deleteProduct,
  listSellerProducts,
  removeProductImage,
  updateProduct,
} from '@/domains/catalog/application/product/seller-products';

export {
  addProductImage,
  createProduct,
  createProductWithImages,
  deleteProduct,
  listSellerProducts,
  removeProductImage,
  updateProduct,
} from '@/domains/catalog/application/product/seller-products';

export const createProductFromRequest = async (sellerId: string, request: FastifyRequest) => {
  const { input, images } = await parseCreateProductRequest(request, createProductSchema);
  const product = await createProductWithImages(sellerId, input, images);

  return { product, imageCount: images.length };
};
