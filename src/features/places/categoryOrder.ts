import type { Category } from '../../api/types';

const order: Record<Category, number> = { FOOD: 0, CAFE: 1, BAR: 2, CULTURE: 3 };

export function sortPlaceCategories<T extends { category: Category }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => order[a.category] - order[b.category]);
}
