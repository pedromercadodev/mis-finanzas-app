import { getDatabase } from './database';
import type { CategoryGroup } from '../utils/types';

export async function getGroups(type?: 'income' | 'expense'): Promise<CategoryGroup[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM category_groups';
  const params: any[] = [];

  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }

  query += ' ORDER BY sortOrder ASC, name ASC';
  return await db.getAllAsync<CategoryGroup>(query, params);
}

export async function getGroupById(id: number): Promise<CategoryGroup | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<CategoryGroup>(
    'SELECT * FROM category_groups WHERE id = ?',
    [id]
  );
}

export async function createGroup(data: Omit<CategoryGroup, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO category_groups (name, icon, color, type, sortOrder) VALUES (?, ?, ?, ?, ?)',
    [data.name, data.icon, data.color, data.type, data.sortOrder]
  );
  return result.lastInsertRowId;
}

export async function updateGroup(id: number, data: Partial<CategoryGroup>): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon); }
  if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color); }
  if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
  if (data.sortOrder !== undefined) { fields.push('sortOrder = ?'); values.push(data.sortOrder); }

  if (fields.length > 0) {
    values.push(id);
    await db.runAsync(`UPDATE category_groups SET ${fields.join(', ')} WHERE id = ?`, values);
  }
}

export async function deleteGroup(id: number): Promise<void> {
  const db = await getDatabase();
  // Reasignar categorías de este grupo a null antes de eliminar
  await db.runAsync('UPDATE categories SET groupId = NULL WHERE groupId = ?', [id]);
  await db.runAsync('DELETE FROM category_groups WHERE id = ?', [id]);
}
