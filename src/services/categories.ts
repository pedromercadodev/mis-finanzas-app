import { db } from './database';
import type { Category, CategoryWithGroup } from '../utils/types';

export async function getCategories(type?: 'income' | 'expense'): Promise<Category[]> {
  let collection = db.categories.orderBy('sortOrder');

  if (type) {
    collection = collection.filter((c) => c.type === type) as any;
  }

  return await collection.toArray();
}

export async function getCategoriesWithGroups(type?: 'income' | 'expense'): Promise<CategoryWithGroup[]> {
  let categories = await db.categories.toArray();
  const groups = await db.categoryGroups.toArray();
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));

  if (type) {
    categories = categories.filter((c) => c.type === type);
  }

  categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return categories.map((c) => ({
    ...c,
    groupName: c.groupId ? groupMap.get(c.groupId) ?? undefined : undefined,
  }));
}

export async function getCategoriesByGroup(groupId: number): Promise<CategoryWithGroup[]> {
  const categories = await db.categories
    .where('groupId')
    .equals(groupId)
    .toArray();

  const group = await db.categoryGroups.get(groupId);

  categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return categories.map((c) => ({
    ...c,
    groupName: group?.name ?? undefined,
  }));
}

export async function createCategory(category: Omit<Category, 'id'> & { groupId?: number | null; sortOrder?: number }): Promise<number> {
  const id = await db.categories.add({
    name: category.name,
    icon: category.icon,
    color: category.color,
    type: category.type,
    budget: category.budget ?? null,
    groupId: category.groupId ?? null,
    sortOrder: category.sortOrder ?? 0,
  } as Category);
  return id;
}

export async function updateCategory(id: number, category: Partial<Category> & { groupId?: number | null; sortOrder?: number }): Promise<void> {
  await db.categories.update(id, category);
}

export async function deleteCategory(id: number): Promise<void> {
  await db.categories.delete(id);
}
