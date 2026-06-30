import { db } from './database';
import type { Account } from '../utils/types';

export async function getAccounts(): Promise<Account[]> {
  return await db.accounts
    .where('isActive')
    .equals(1)
    .reverse()
    .sortBy('createdAt');
}

export async function getAccountById(id: number): Promise<Account | null> {
  return (await db.accounts.get(id)) ?? null;
}

export async function createAccount(account: Omit<Account, 'id' | 'createdAt'>): Promise<number> {
  const now = new Date().toISOString();
  const id = await db.accounts.add({
    ...account,
    platform: account.platform ?? null,
    createdAt: now,
  } as Account);
  return id;
}

export async function updateAccount(id: number, account: Partial<Account>): Promise<void> {
  await db.accounts.update(id, account);
}

export async function deleteAccount(id: number): Promise<void> {
  await db.accounts.update(id, { isActive: 0 });
}

export async function getAccountBalance(id: number): Promise<{ balanceUSD: number; balanceBS: number }> {
  const account = await getAccountById(id);
  if (!account) return { balanceUSD: 0, balanceBS: 0 };

  const transactions = await db.transactions
    .where('accountId')
    .equals(id)
    .toArray();

  let incomeUSD = 0, incomeBS = 0;
  let expenseUSD = 0, expenseBS = 0;
  let transferOutUSD = 0, transferOutBS = 0;
  let transferInUSD = 0, transferInBS = 0;

  for (const tx of transactions) {
    if (tx.type === 'income') {
      incomeUSD += tx.amountUSD || 0;
      incomeBS += tx.amountBS || 0;
    } else if (tx.type === 'expense') {
      expenseUSD += tx.amountUSD || 0;
      expenseBS += tx.amountBS || 0;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === id) {
        transferOutUSD += tx.amountUSD || 0;
        transferOutBS += tx.amountBS || 0;
      }
    }
  }

  // También obtener transferencias hacia esta cuenta
  const transfersIn = await db.transactions
    .where('transferToAccountId')
    .equals(id)
    .toArray();

  for (const tx of transfersIn) {
    if (tx.type === 'transfer') {
      transferInUSD += tx.amountUSD || 0;
      transferInBS += tx.amountBS || 0;
    }
  }

  return {
    balanceUSD: account.initialBalanceUSD + incomeUSD - expenseUSD - transferOutUSD + transferInUSD,
    balanceBS: account.initialBalanceBS + incomeBS - expenseBS - transferOutBS + transferInBS,
  };
}

export async function getAccountsByPlatform(): Promise<{ platform: string; accounts: Account[]; totalUSD: number; totalBS: number }[]> {
  const allAccounts = await db.accounts
    .where('isActive')
    .equals(1)
    .filter(a => a.platform != null && a.platform !== '')
    .sortBy('platform');

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
