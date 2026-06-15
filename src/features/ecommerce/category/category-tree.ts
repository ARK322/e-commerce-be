export type CategoryLink = {
  id: string;
  parentId: string | null;
};

export type CategoryTreeNode<T> = T & {
  children: CategoryTreeNode<T>[];
};

const normalizeParentId = (parentId: string | null | undefined): string | null =>
  parentId ?? null;

export const buildCategoryTree = <T extends CategoryLink>(
  items: T[],
  toNode: (item: T) => Omit<CategoryTreeNode<T>, 'children'>
): CategoryTreeNode<Omit<CategoryTreeNode<T>, 'children'>>[] => {
  const byParent = new Map<string | null, T[]>();

  for (const item of items) {
    const parentKey = normalizeParentId(item.parentId);
    const siblings = byParent.get(parentKey);

    if (siblings) {
      siblings.push(item);
    } else {
      byParent.set(parentKey, [item]);
    }
  }

  const buildLevel = (parentId: string | null): CategoryTreeNode<Omit<CategoryTreeNode<T>, 'children'>>[] => {
    const siblings = byParent.get(parentId) ?? [];

    return siblings.map((item) => ({
      ...toNode(item),
      children: buildLevel(item.id),
    }));
  };

  return buildLevel(null);
};

export const collectDescendantIds = (
  categoryId: string,
  items: CategoryLink[]
): string[] => {
  const childrenByParent = new Map<string, string[]>();

  for (const item of items) {
    const parentId = normalizeParentId(item.parentId);

    if (!parentId) {
      continue;
    }

    const siblings = childrenByParent.get(parentId);

    if (siblings) {
      siblings.push(item.id);
    } else {
      childrenByParent.set(parentId, [item.id]);
    }
  }

  const descendants: string[] = [];
  const queue = [...(childrenByParent.get(categoryId) ?? [])];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    descendants.push(currentId);
    queue.push(...(childrenByParent.get(currentId) ?? []));
  }

  return descendants;
};

export const isDescendantOf = (
  categoryId: string,
  ancestorId: string,
  items: CategoryLink[]
): boolean => {
  if (categoryId === ancestorId) {
    return true;
  }

  const parentById = new Map(items.map((item) => [item.id, normalizeParentId(item.parentId)]));

  let currentParentId = parentById.get(categoryId) ?? null;

  while (currentParentId) {
    if (currentParentId === ancestorId) {
      return true;
    }

    currentParentId = parentById.get(currentParentId) ?? null;
  }

  return false;
};

export const filterCategoriesWithActiveAncestors = <
  T extends CategoryLink & { isActive: boolean },
>(
  items: T[]
): T[] => {
  const activeIds = new Set(items.filter((item) => item.isActive).map((item) => item.id));

  return items.filter((item) => {
    if (!item.isActive) {
      return false;
    }

    let parentId = normalizeParentId(item.parentId);

    while (parentId) {
      if (!activeIds.has(parentId)) {
        return false;
      }

      const parent = items.find((candidate) => candidate.id === parentId);

      if (!parent) {
        return false;
      }

      parentId = normalizeParentId(parent.parentId);
    }

    return true;
  });
};
