import { getDatabase } from './database';
import type { Goal } from '../utils/types';

export async function getGoals(): Promise<Goal[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Goal>('SELECT * FROM goals ORDER BY createdAt DESC');
}

export async function createGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO goals (name, targetAmount, currentAmount, currency, accountId, deadline, periodType, celebratedAt, lastProgressAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [goal.name, goal.targetAmount, goal.currentAmount, goal.currency, goal.accountId, goal.deadline, goal.periodType, goal.celebratedAt, goal.lastProgressAt]
  );
  return result.lastInsertRowId;
}

export async function updateGoalProgress(id: number, amount: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE goals SET currentAmount = currentAmount + ?, lastProgressAt = datetime('now') WHERE id = ?",
    [amount, id]
  );
}

export async function deleteGoal(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM goals WHERE id = ?', [id]);
}

export async function markGoalCelebrated(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE goals SET celebratedAt = datetime('now') WHERE id = ?",
    [id]
  );
}
