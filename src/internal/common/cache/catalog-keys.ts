export type CatalogProductsListQuery = {
  page: number;
  limit: number;
  categoryId?: string;
  search?: string;
};

const PREFIX = 'catalog:';

export const catalogCacheKeys = {
  publicCategories: () => `${PREFIX}categories:public`,
  productsList: (query: CatalogProductsListQuery) => {
    const parts = [`page=${query.page}`, `limit=${query.limit}`];

    if (query.categoryId) {
      parts.push(`categoryId=${query.categoryId}`);
    }

    if (query.search) {
      parts.push(`search=${query.search}`);
    }

    return `${PREFIX}products:list:${parts.join('&')}`;
  },
  productDetail: (productId: string) => `${PREFIX}products:detail:${productId}`,
  visibleCategoryIds: () => `${PREFIX}visible-category-ids`,
  categoriesPrefix: () => `${PREFIX}categories:`,
  productsPrefix: () => `${PREFIX}products:`,
} as const;
