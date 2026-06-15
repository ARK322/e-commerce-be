import { describe, expect, it } from 'vitest';
import {
  buildCategoryTree,
  collectDescendantIds,
  filterCategoriesWithActiveAncestors,
  isDescendantOf,
} from '@/features/ecommerce/category/category-tree';

const flatCategories = [
  { id: 'root-1', parentId: null, name: 'Elektronik', isActive: true },
  { id: 'child-1', parentId: 'root-1', name: 'Telefon', isActive: true },
  { id: 'child-2', parentId: 'root-1', name: 'Bilgisayar', isActive: true },
  { id: 'grandchild-1', parentId: 'child-1', name: 'Android', isActive: true },
  { id: 'root-2', parentId: null, name: 'Giyim', isActive: true },
];

describe('buildCategoryTree', () => {
  it('sınırsız derinlikte ağaç oluşturur', () => {
    const tree = buildCategoryTree(flatCategories, (category) => ({
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      isActive: category.isActive,
    }));

    expect(tree).toHaveLength(2);
    expect(tree[0]?.children).toHaveLength(2);
    expect(tree[0]?.children[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.children[0]?.id).toBe('grandchild-1');
  });
});

describe('collectDescendantIds', () => {
  it('tüm alt kategori idlerini döner', () => {
    expect(collectDescendantIds('root-1', flatCategories).sort()).toEqual(
      ['child-1', 'child-2', 'grandchild-1'].sort()
    );
  });
});

describe('isDescendantOf', () => {
  it('döngü taşımayı engellemek için alt ağacı tespit eder', () => {
    expect(isDescendantOf('child-1', 'root-1', flatCategories)).toBe(true);
    expect(isDescendantOf('root-1', 'child-1', flatCategories)).toBe(false);
    expect(isDescendantOf('root-1', 'root-1', flatCategories)).toBe(true);
  });
});

describe('filterCategoriesWithActiveAncestors', () => {
  it('pasif üst kategorinin altını gizler', () => {
    const categories = [
      { id: 'root-1', parentId: null, name: 'Elektronik', isActive: false },
      { id: 'child-1', parentId: 'root-1', name: 'Telefon', isActive: true },
    ];

    expect(filterCategoriesWithActiveAncestors(categories)).toEqual([]);
  });
});
