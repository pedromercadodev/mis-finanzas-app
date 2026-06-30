import { getDatabase } from './database';
import type { Account } from '../utils/types';

export async function getAccounts(): Promise<Account[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Account>(
    'SELECT * FROM accounts WHERE isActive = 1 ORDER BY createdAt ASC'
  );
}

export async function getAccountById(id: number): Promise<Account | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<Account>(
    'SELECT * FROM accounts WHERE id = ?',
    [id]
  );
}

export async function createAccount(account: Omit<Account, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO accounts (name, type, currency, initialBalanceUSD, initialBalanceBS, icon, color, isActive, platform)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      account.name,
      account.type,
      account.currency,
      account.initialBalanceUSD,
      account.initialBalanceBS,
      account.icon,
      account.color,
      account.isActive,
      account.platform ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateAccount(id: number, account: Partial<Account>): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (account.name !== undefined) { fields.push('name = ?'); values.push(account.name); }
  if (account.type !== undefined) { fields.push('type = ?'); values.push(account.type); }
  if (account.currency !== undefined) { fields.push('currency = ?'); values.push(account.currency); }
  if (account.initialBalanceUSD !== undefined) { fields.push('initialBalanceUSD = ?'); values.push(account.initialBalanceUSD); }
  if (account.initialBalanceBS !== undefined) { fields.push('initialBalanceBS = ?'); values.push(account.initialBalanceBS); }
  if (account.icon !== undefined) { fields.push('icon = ?'); values.push(account.icon); }
  if (account.color !== undefined) { fields.push('color = ?'); values.push(account.color); }
  if (account.isActive !== undefined) { fields.push('isActive = ?'); values.push(account.isActive); }

  if (fields.length > 0) {
    values.push(id);
    await db.runAsync(
      `UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }
}

export async function deleteAccount(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE accounts SET isActive = 0 WHERE id = ?', [id]);
}

export async function getAccountBalance(id: number): Promise<{ balanceUSD: number; balanceBS: number }> {
  const db = await getDatabase();
  const account = await getAccountById(id);
  if (!account) return { balanceUSD: 0, balanceBS: 0 };

  const income = await db.getFirstAsync<{ usd: number; bs: number }>(
    `SELECT COALESCE(SUM(amountUSD), 0) as usd, COALESCE(SUM(amountBS), 0) as bs
     FROM transactions WHERE accountId = ? AND type = 'income'`,
    [id]
  );

  const expense = await db.getFirstAsync<{ usd: number; bs: number }>(
    `SELECT COALESCE(SUM(amountUSD), 0) as usd, COALESCE(SUM(amountBS), 0) as bs
     FROM transactions WHERE accountId = ? AND type = 'expense'`,
    [id]
  );

  const transfersOut = await db.getFirstAsync<{ usd: number; bs: number }>(
    `SELECT COALESCE(SUM(amountUSD), 0) as usd, COALESCE(SUM(amountBS), 0) as bs
     FROM transactions WHERE accountId = ? AND type = 'transfer'`,
    [id]
  );

  const transfersIn = await db.getFirstAsync<{ usd: number; bs: number }>(
    `SELECT COALESCE(SUM(amountUSD), 0) as usd, COALESCE(SUM(amountBS), 0) as bs
     FROM transactions WHERE transferToAccountId = ? AND type = 'transfer'`,
    [id]
  );

  return {
    balanceUSD: account.initialBalanceUSD + (income?.usd || 0) - (expense?.usd || 0) - (transfersOut?.usd || 0) + (transfersIn?.usd || 0),
    balanceBS: account.initialBalanceBS + (income?.bs || 0) - (expense?.bs || 0) - (transfersOut?.bs || 0) + (transfersIn?.bs || 0),
  };
}

export async function getAccountsByPlatform(): Promise<{ platform: string; accounts: Account[]; totalUSD: number; totalBS: number }[]> {
  const db = await getDatabase();
  const allAccounts = await db.getAllAsync<Account>(
    "SELECT * FROM accounts WHERE isActive = 1 AND platform IS NOT NULL AND platform != '' ORDER BY platform, createdAt ASC"
  );

  const platformMap = new Map<string, Account[]>();
  for (const acc of allAccounts) {
    const p = acc.platform!;
    if (!platformMap.has(p)) platformMap.set(p, []);
    platformMap.get(p)!.push(acc);
  }

  const result: { platform: string; accounts: Account[]; totalUSD: number; totalBS: number }[] = [];
  for (const [platform, accounts] of platformMap) {
    let totalUSD = 0;
    let totalBS = 0;
    for (const acc of accounts) {
      const balance = await getAccountBalance(acc.id);
      totalUSD += balance.balanceUSD;
      totalBS += balance.balanceBS;
    }
    result.push({ platform, accounts, totalUSD, totalBS });
  }
  return result;
}
