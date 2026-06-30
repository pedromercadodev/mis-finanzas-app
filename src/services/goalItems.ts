import { getDatabase } from './database';
import type { GoalItem } from '../utils/types';

export async function getItemsByGoalId(goalId: number): Promise<GoalItem[]> {
  const db = await getDatabase();
  return await db.getAllAsync<GoalItem>(
    'SELECT * FROM goal_items WHERE goalId = ? ORDER BY sortOrder ASC, id ASC',
    [goalId]
  );
}

export async function createItem(data: Omit<GoalItem, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO goal_items (goalId, name, targetAmount, currentAmount, isCompleted, sortOrder)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.goalId, data.name, data.targetAmount, data.currentAmount, data.isCompleted, data.sortOrder]
  );
  return result.lastInsertRowId;
}

export async function updateItemProgress(id: number, amount: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE goal_items SET currentAmount = currentAmount + ? WHERE id = ?',
    [amount, id]
  );
}

export async function toggleItemCompleted(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE goal_items SET isCompleted = CASE WHEN isCompleted = 0 THEN 1 ELSE 0 END WHERE id = ?`,
    [id]
  );
}

export async function deleteItem(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM goal_items WHERE id = ?', [id]);
}

export async function recalculateGoalProgress(goalId: number): Promise<void> {
  const db = await getDatabase();
  // Sumar currentAmount de todos los items de la meta
  const result = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(currentAmount), 0) as total FROM goal_items WHERE goalId = ?',
    [goalId]
  );
  const total = result?.total ?? 0;
  // Actualizar currentAmount de la meta con la suma de los items
  await db.runAsync('UPDATE goals SET currentAmount = ?, lastProgressAt = datetime(\'now\') WHERE id = ?', [total, goalId]);
}
