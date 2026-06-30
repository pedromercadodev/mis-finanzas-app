import { getDatabase } from './database';
import type { Transaction } from '../utils/types';

export async function getTransactions(options?: {
  accountId?: number;
  month?: string;
  limit?: number;
}): Promise<Transaction[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params: any[] = [];

  if (options?.accountId) {
    query += ' AND (accountId = ? OR transferToAccountId = ?)';
    params.push(options.accountId, options.accountId);
  }
  if (options?.month) {
    query += ' AND date LIKE ?';
    params.push(`${options.month}%`);
  }

  query += ' ORDER BY date DESC, createdAt DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  return await db.getAllAsync<Transaction>(query, params);
}

export async function getTransactionById(id: number): Promise<Transaction | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<Transaction>('SELECT * FROM transactions WHERE id = ?', [id]);
}

export async function createTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO transactions (type, description, amountUSD, amountBS, currency, exchangeRate, accountId, transferToAccountId, categoryId, date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tx.type,
      tx.description,
      tx.amountUSD,
      tx.amountBS,
      tx.currency,
      tx.exchangeRate,
      tx.accountId,
      tx.transferToAccountId,
      tx.categoryId,
      tx.date,
      tx.notes,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateTransaction(id: number, tx: Partial<Transaction>): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (tx.type !== undefined) { fields.push('type = ?'); values.push(tx.type); }
  if (tx.description !== undefined) { fields.push('description = ?'); values.push(tx.description); }
  if (tx.amountUSD !== undefined) { fields.push('amountUSD = ?'); values.push(tx.amountUSD); }
  if (tx.amountBS !== undefined) { fields.push('amountBS = ?'); values.push(tx.amountBS); }
  if (tx.currency !== undefined) { fields.push('currency = ?'); values.push(tx.currency); }
  if (tx.exchangeRate !== undefined) { fields.push('exchangeRate = ?'); values.push(tx.exchangeRate); }
  if (tx.accountId !== undefined) { fields.push('accountId = ?'); values.push(tx.accountId); }
  if (tx.categoryId !== undefined) { fields.push('categoryId = ?'); values.push(tx.categoryId); }
  if (tx.date !== undefined) { fields.push('date = ?'); values.push(tx.date); }
  if (tx.notes !== undefined) { fields.push('notes = ?'); values.push(tx.notes); }

  if (fields.length > 0) {
    values.push(id);
    await db.runAsync(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, values);
  }
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function getMonthlySummary(month: string): Promise<{
  incomeUSD: number;
  incomeBS: number;
  expenseUSD: number;
  expenseBS: number;
}> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{
    incomeUSD: number;
    incomeBS: number;
    expenseUSD: number;
    expenseBS: number;
  }>(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN COALESCE(amountUSD, 0) ELSE 0 END), 0) as incomeUSD,
      COALESCE(SUM(CASE WHEN type = 'income' THEN COALESCE(amountBS, 0) ELSE 0 END), 0) as incomeBS,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN COALESCE(amountUSD, 0) ELSE 0 END), 0) as expenseUSD,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN COALESCE(amountBS, 0) ELSE 0 END), 0) as expenseBS
     FROM transactions
     WHERE date LIKE ?`,
    [`${month}%`]
  );

  return result || { incomeUSD: 0, incomeBS: 0, expenseUSD: 0, expenseBS: 0 };
}

export async function getPeriodSummary(startDate: string, endDate: string): Promise<{
  incomeUSD: number;
  incomeBS: number;
  expenseUSD: number;
  expenseBS: number;
}> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{
    incomeUSD: number;
    incomeBS: number;
    expenseUSD: number;
    expenseBS: number;
  }>(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN COALESCE(amountUSD, 0) ELSE 0 END), 0) as incomeUSD,
      COALESCE(SUM(CASE WHEN type = 'income' THEN COALESCE(amountBS, 0) ELSE 0 END), 0) as incomeBS,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN COALESCE(amountUSD, 0) ELSE 0 END), 0) as expenseUSD,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN COALESCE(amountBS, 0) ELSE 0 END), 0) as expenseBS
     FROM transactions
     WHERE date >= ? AND date <= ?`,
    [startDate, endDate]
  );

  return result || { incomeUSD: 0, incomeBS: 0, expenseUSD: 0, expenseBS: 0 };
}
