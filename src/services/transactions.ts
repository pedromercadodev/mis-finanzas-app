import { db } from './database';
import type { Transaction } from '../utils/types';

export async function getTransactions(options?: {
  accountId?: number;
  month?: string;
  limit?: number;
}): Promise<Transaction[]> {
  let results = await db.transactions.toArray();

  if (options?.accountId) {
    results = results.filter(
      (tx: Transaction) => tx.accountId === options.accountId || tx.transferToAccountId === options.accountId
    );
  }

  if (options?.month) {
    results = results.filter((tx: Transaction) => tx.date.startsWith(options.month!));
  }

  // Ordenar por date DESC, createdAt DESC
  results.sort((a: Transaction, b: Transaction) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

export async function getTransactionById(id: number): Promise<Transaction | null> {
  return (await db.transactions.get(id)) ?? null;
}

export async function createTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): Promise<number> {
  const now = new Date().toISOString();
  const id = await db.transactions.add({
    ...tx,
    transferToAccountId: tx.transferToAccountId ?? null,
    categoryId: tx.categoryId ?? null,
    notes: tx.notes ?? null,
    exchangeRate: tx.exchangeRate ?? null,
    createdAt: now,
  } as Transaction);
  return id;
}

export async function updateTransaction(id: number, tx: Partial<Transaction>): Promise<void> {
  await db.transactions.update(id, tx);
}

export async function deleteTransaction(id: number): Promise<void> {
  await db.transactions.delete(id);
}

export async function getMonthlySummary(month: string): Promise<{
  incomeUSD: number;
  incomeBS: number;
  expenseUSD: number;
  expenseBS: number;
}> {
  const transactions = await db.transactions
    .filter((tx: Transaction) => tx.date.startsWith(month))
    .toArray();

  let incomeUSD = 0, incomeBS = 0;
  let expenseUSD = 0, expenseBS = 0;

  for (const tx of transactions) {
    if (tx.type === 'income') {
      incomeUSD += tx.amountUSD || 0;
      incomeBS += tx.amountBS || 0;
    } else if (tx.type === 'expense') {
      expenseUSD += tx.amountUSD || 0;
      expenseBS += tx.amountBS || 0;
    }
  }

  return { incomeUSD, incomeBS, expenseUSD, expenseBS };
}

export async function getPeriodSummary(startDate: string, endDate: string): Promise<{
  incomeUSD: number;
  incomeBS: number;
  expenseUSD: number;
  expenseBS: number;
}> {
  const transactions = await db.transactions
    .filter((tx: Transaction) => tx.date >= startDate && tx.date <= endDate)
    .toArray();

  let incomeUSD = 0, incomeBS = 0;
  let expenseUSD = 0, expenseBS = 0;

  for (const tx of transactions) {
    if (tx.type === 'income') {
      incomeUSD += tx.amountUSD || 0;
      incomeBS += tx.amountBS || 0;
    } else if (tx.type === 'expense') {
      expenseUSD += tx.amountUSD || 0;
      expenseBS += tx.amountBS || 0;
    }
  }

  return { incomeUSD, incomeBS, expenseUSD, expenseBS };
}
