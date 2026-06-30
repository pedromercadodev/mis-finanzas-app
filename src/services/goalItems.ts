import { db } from './database';
import type { GoalItem } from '../utils/types';

export async function getItemsByGoalId(goalId: number): Promise<GoalItem[]> {
  return await db.goalItems
    .where('goalId')
    .equals(goalId)
    .sortBy('sortOrder');
}

export async function createItem(data: Omit<GoalItem, 'id' | 'createdAt'>): Promise<number> {
  const now = new Date().toISOString();
  const id = await db.goalItems.add({
    ...data,
    createdAt: now,
  } as GoalItem);
  return id;
}

export async function updateItemProgress(id: number, amount: number): Promise<void> {
  const item = await db.goalItems.get(id);
  if (item) {
    await db.goalItems.update(id, {
      currentAmount: (item.currentAmount || 0) + amount,
    });
  }
}

export async function toggleItemCompleted(id: number): Promise<void> {
  const item = await db.goalItems.get(id);
  if (item) {
    await db.goalItems.update(id, {
      isCompleted: item.isCompleted ? 0 : 1,
    });
  }
}

export async function deleteItem(id: number): Promise<void> {
  await db.goalItems.delete(id);
}

export async function recalculateGoalProgress(goalId: number): Promise<void> {
  const items = await db.goalItems.where('goalId').equals(goalId).toArray();
  const total = items.reduce((sum, item) => sum + (item.currentAmount || 0), 0);
  await db.goals.update(goalId, {
    currentAmount: total,
    lastProgressAt: new Date().toISOString(),
  });
}
