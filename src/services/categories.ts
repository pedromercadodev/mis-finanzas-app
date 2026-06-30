import { getDatabase } from './database';
import type { Category, CategoryWithGroup } from '../utils/types';

export async function getCategories(type?: 'income' | 'expense'): Promise<Category[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM categories';
  const params: any[] = [];

  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }

  query += ' ORDER BY sortOrder ASC, name ASC';
  return await db.getAllAsync<Category>(query, params);
}

export async function getCategoriesWithGroups(type?: 'income' | 'expense'): Promise<CategoryWithGroup[]> {
  const db = await getDatabase();
  let query = `
    SELECT c.*, g.name as groupName
    FROM categories c
    LEFT JOIN category_groups g ON c.groupId = g.id
  `;
  const params: any[] = [];

  if (type) {
    query += ' WHERE c.type = ?';
    params.push(type);
  }

  query += ' ORDER BY c.sortOrder ASC, c.name ASC';
  return await db.getAllAsync<CategoryWithGroup>(query, params);
}

export async function getCategoriesByGroup(groupId: number): Promise<CategoryWithGroup[]> {
  const db = await getDatabase();
  return await db.getAllAsync<CategoryWithGroup>(
    `SELECT c.*, g.name as groupName
     FROM categories c
     LEFT JOIN category_groups g ON c.groupId = g.id
     WHERE c.groupId = ?
     ORDER BY c.sortOrder ASC, c.name ASC`,
    [groupId]
  );
}

export async function createCategory(category: Omit<Category, 'id'> & { groupId?: number | null; sortOrder?: number }): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO categories (name, icon, color, type, budget, groupId, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [category.name, category.icon, category.color, category.type, category.budget ?? null, category.groupId ?? null, category.sortOrder ?? 0]
  );
  return result.lastInsertRowId;
}

export async function updateCategory(id: number, category: Partial<Category> & { groupId?: number | null; sortOrder?: number }): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (category.name !== undefined) { fields.push('name = ?'); values.push(category.name); }
  if (category.icon !== undefined) { fields.push('icon = ?'); values.push(category.icon); }
  if (category.color !== undefined) { fields.push('color = ?'); values.push(category.color); }
  if (category.type !== undefined) { fields.push('type = ?'); values.push(category.type); }
  if (category.budget !== undefined) { fields.push('budget = ?'); values.push(category.budget); }
  if (category.groupId !== undefined) { fields.push('groupId = ?'); values.push(category.groupId); }
  if (category.sortOrder !== undefined) { fields.push('sortOrder = ?'); values.push(category.sortOrder); }

  if (fields.length > 0) {
    values.push(id);
    await db.runAsync(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
  }
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}
