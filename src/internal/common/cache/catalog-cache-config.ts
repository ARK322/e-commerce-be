import { env } from '@/config/env';

export const catalogCacheConfig = {
  get enabled(): boolean {
    return env.catalogCacheEnabled;
  },

  get categoriesTtlMs(): number {
    return env.catalogCategoriesCacheTtlMs;
  },

  get productsListTtlMs(): number {
    return env.catalogProductsListCacheTtlMs;
  },

  get productDetailTtlMs(): number {
    return env.catalogProductDetailCacheTtlMs;
  },

  get visibleCategoriesTtlMs(): number {
    return env.catalogVisibleCategoriesCacheTtlMs;
  },
};
