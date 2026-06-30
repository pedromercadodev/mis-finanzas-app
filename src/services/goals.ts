import { db } from './database';
import type { Goal } from '../utils/types';

export async function getGoals(): Promise<Goal[]> {
  return await db.goals
    .orderBy('createdAt')
    .reverse()
    .toArray();
}

export async function createGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Promise<number> {
  const now = new Date().toISOString();
  const id = await db.goals.add({
    ...goal,
    createdAt: now,
  } as Goal);
  return id;
}

export async function updateGoalProgress(id: number, amount: number): Promise<void> {
  const goal = await db.goals.get(id);
  if (goal) {
    await db.goals.update(id, {
      currentAmount: (goal.currentAmount || 0) + amount,
      lastProgressAt: new Date().toISOString(),
    });
  }
}

export async function deleteGoal(id: number): Promise<void> {
  await db.goals.delete(id);
}

export async function markGoalCelebrated(id: number): Promise<void> {
  await db.goals.update(id, {
    celebratedAt: new Date().toISOString(),
  });
}
