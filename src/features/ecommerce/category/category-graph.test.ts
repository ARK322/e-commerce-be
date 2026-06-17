import { describe, expect, it } from 'vitest';
import {
  buildCategoryForest,
  collectAncestorPaths,
  collectDescendantIds,
  collectLeafIdsInSubtree,
  filterCategoriesWithActiveAncestors,
  wouldCreateCycle,
} from '@/features/ecommerce/category/category-graph';

const graphNodes = [
  {
    id: 'root-1',
    parentIds: [],
    childIds: ['child-1', 'child-2'],
    name: 'Elektronik',
    isActive: true,
    isLeaf: false,
  },
  {
    id: 'child-1',
    parentIds: ['root-1'],
    childIds: ['grandchild-1'],
    name: 'Telefon',
    isActive: true,
    isLeaf: false,
  },
  {
    id: 'child-2',
    parentIds: ['root-1'],
    childIds: [],
    name: 'Bilgisayar',
    isActive: true,
    isLeaf: true,
  },
  {
    id: 'grandchild-1',
    parentIds: ['child-1'],
    childIds: [],
    name: 'Android',
    isActive: true,
    isLeaf: true,
  },
  {
    id: 'root-2',
    parentIds: [],
    childIds: [],
    name: 'Giyim',
    isActive: true,
    isLeaf: true,
  },
];

describe('buildCategoryForest', () => {
  it('kök kategorilerden children ile orman oluşturur', () => {
    const forest = buildCategoryForest(graphNodes, (category) => ({
      id: category.id,
      parentIds: category.parentIds,
      childIds: category.childIds,
      name: category.name,
      isLeaf: category.isLeaf,
    }));

    expect(forest).toHaveLength(2);
    expect(forest[0]?.children).toHaveLength(2);
    expect(forest[0]?.children[0]?.children).toHaveLength(1);
    expect(forest[0]?.children[0]?.children[0]?.id).toBe('grandchild-1');
  });
});

describe('collectDescendantIds', () => {
  it('tüm alt kategori idlerini döner', () => {
    expect(collectDescendantIds('root-1', graphNodes).sort()).toEqual(
      ['child-1', 'child-2', 'grandchild-1'].sort()
    );
  });
});

describe('collectLeafIdsInSubtree', () => {
  it('alt ağaçtaki yalnızca leaf idlerini döner', () => {
    expect(collectLeafIdsInSubtree('root-1', graphNodes).sort()).toEqual(
      ['child-2', 'grandchild-1'].sort()
    );
  });
});

describe('wouldCreateCycle', () => {
  it('döngü oluşturacak bağlantıyı tespit eder', () => {
    expect(wouldCreateCycle('child-1', 'root-1', graphNodes)).toBe(true);
    expect(wouldCreateCycle('root-1', 'child-1', graphNodes)).toBe(false);
    expect(wouldCreateCycle('root-1', 'root-1', graphNodes)).toBe(true);
  });
});

describe('collectAncestorPaths', () => {
  it('birden fazla parent yolunu döner', () => {
    const multiParentGraph = [
      ...graphNodes.filter((node) => node.id !== 'grandchild-1'),
      {
        id: 'grandchild-1',
        parentIds: ['child-1', 'root-2'],
        childIds: [],
        name: 'Android',
        isActive: true,
        isLeaf: true,
      },
    ];

    const paths = collectAncestorPaths('grandchild-1', multiParentGraph);

    expect(paths).toEqual(
      expect.arrayContaining([
        ['root-1', 'child-1', 'grandchild-1'],
        ['root-2', 'grandchild-1'],
      ])
    );
  });
});

describe('filterCategoriesWithActiveAncestors', () => {
  it('pasif üst kategorinin altını gizler', () => {
    const categories = [
      {
        id: 'root-1',
        parentIds: [],
        childIds: ['child-1'],
        name: 'Elektronik',
        isActive: false,
        isLeaf: false,
      },
      {
        id: 'child-1',
        parentIds: ['root-1'],
        childIds: [],
        name: 'Telefon',
        isActive: true,
        isLeaf: true,
      },
    ];

    expect(filterCategoriesWithActiveAncestors(categories)).toEqual([]);
  });
});
