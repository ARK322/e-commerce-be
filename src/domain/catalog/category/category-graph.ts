export type CategoryGraphNode = {
  id: string;
  parentIds: string[];
  childIds: string[];
  isActive: boolean;
  isLeaf?: boolean;
};

export type CategoryForestNode<T> = T & {
  children: CategoryForestNode<T>[];
};

export const MAX_PARENTS_PER_NODE = 10;
export const MAX_CHILDREN_PER_NODE = 500;

export const uniqueIds = (ids: string[]) => [...new Set(ids)];

export const isReachableViaChildren = (
  fromId: string,
  toId: string,
  nodes: CategoryGraphNode[]
): boolean => {
  if (fromId === toId) {
    return true;
  }

  const childIdsByNode = new Map(nodes.map((node) => [node.id, node.childIds]));
  const visited = new Set<string>();
  const queue = [...(childIdsByNode.get(fromId) ?? [])];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (currentId === toId) {
      return true;
    }

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    queue.push(...(childIdsByNode.get(currentId) ?? []));
  }

  return false;
};

export const wouldCreateCycle = (
  parentId: string,
  childId: string,
  nodes: CategoryGraphNode[]
): boolean => {
  if (parentId === childId) {
    return true;
  }

  return isReachableViaChildren(childId, parentId, nodes);
};

export const collectDescendantIds = (categoryId: string, nodes: CategoryGraphNode[]): string[] => {
  const childIdsByNode = new Map(nodes.map((node) => [node.id, node.childIds]));
  const descendants: string[] = [];
  const visited = new Set<string>();
  const queue = [...(childIdsByNode.get(categoryId) ?? [])];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    descendants.push(currentId);
    queue.push(...(childIdsByNode.get(currentId) ?? []));
  }

  return descendants;
};

export const collectLeafIdsInSubtree = (
  categoryId: string,
  nodes: CategoryGraphNode[]
): string[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const root = byId.get(categoryId);

  if (!root) {
    return [];
  }

  const subtreeIds = [categoryId, ...collectDescendantIds(categoryId, nodes)];

  return subtreeIds.filter((id) => {
    const node = byId.get(id);
    return node?.isLeaf === true || (node?.childIds.length ?? 0) === 0;
  });
};

export const buildCategoryForest = <T extends { id: string; childIds: string[] }>(
  items: T[],
  toNode: (item: T) => Omit<CategoryForestNode<T>, 'children'>
): CategoryForestNode<Omit<CategoryForestNode<T>, 'children'>>[] => {
  const byId = new Map(items.map((item) => [item.id, item]));

  const buildNode = (item: T): CategoryForestNode<Omit<CategoryForestNode<T>, 'children'>> => ({
    ...toNode(item),
    children: item.childIds
      .map((childId) => byId.get(childId))
      .filter((child): child is T => child !== undefined)
      .map((child) => buildNode(child)),
  });

  const roots = items.filter(
    (item) => 'parentIds' in item && Array.isArray(item.parentIds) && item.parentIds.length === 0
  );

  return roots.map((root) => buildNode(root));
};

export const filterCategoriesWithActiveAncestors = <
  T extends CategoryGraphNode,
>(
  items: T[]
): T[] => {
  const byId = new Map(items.map((item) => [item.id, item]));

  const isVisible = (id: string, visiting = new Set<string>()): boolean => {
    if (visiting.has(id)) {
      return false;
    }

    const item = byId.get(id);

    if (!item || !item.isActive) {
      return false;
    }

    if (item.parentIds.length === 0) {
      return true;
    }

    visiting.add(id);

    const visible = item.parentIds.every((parentId) => isVisible(parentId, visiting));

    visiting.delete(id);

    return visible;
  };

  return items.filter((item) => isVisible(item.id));
};

export const collectAncestorPaths = (
  categoryId: string,
  nodes: CategoryGraphNode[]
): string[][] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const buildPaths = (id: string, visiting = new Set<string>()): string[][] => {
    if (visiting.has(id)) {
      return [];
    }

    const node = byId.get(id);

    if (!node) {
      return [];
    }

    if (node.parentIds.length === 0) {
      return [[id]];
    }

    visiting.add(id);

    const paths = node.parentIds.flatMap((parentId) =>
      buildPaths(parentId, visiting).map((path) => [...path, id])
    );

    visiting.delete(id);

    return paths;
  };

  return buildPaths(categoryId);
};
