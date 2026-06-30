import { db } from './database';
import type { CategoryGroup } from '../utils/types';

export async function getGroups(type?: 'income' | 'expense'): Promise<CategoryGroup[]> {
  let collection = db.categoryGroups.orderBy('sortOrder');

  if (type) {
    collection = collection.filter((g) => g.type === type) as any;
  }

  const results = await collection.toArray();
  return results;
}

export async function getGroupById(id: number): Promise<CategoryGroup | null> {
  return (await db.categoryGroups.get(id)) ?? null;
}

export async function createGroup(data: Omit<CategoryGroup, 'id' | 'createdAt'>): Promise<number> {
  const now = new Date().toISOString();
  const id = await db.categoryGroups.add({
    ...data,
    createdAt: now,
  } as CategoryGroup);
  return id;
}

export async function updateGroup(id: number, data: Partial<CategoryGroup>): Promise<void> {
  await db.categoryGroups.update(id, data);
}

export async function deleteGroup(id: number): Promise<void> {
  // Reasignar categorías de este grupo a null antes de eliminar
  const categories = await db.categories.where('groupId').equals(id).toArray();
  for (const cat of categories) {
    await db.categories.update(cat.id, { groupId: null });
  }
  await db.categoryGroups.delete(id);
}
