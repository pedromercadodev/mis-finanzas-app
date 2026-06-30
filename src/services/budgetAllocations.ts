import { getDatabase } from './database';
import type { BudgetAllocation, CategorySpending, GroupWithCategories, CategoryWithGroup } from '../utils/types';
import { getCategoriesWithGroups } from './categories';
import { getGroups } from './categoryGroups';

export async function getAllocation(categoryId: number, month: string): Promise<BudgetAllocation | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<BudgetAllocation>(
    'SELECT * FROM budget_allocations WHERE categoryId = ? AND month = ?',
    [categoryId, month]
  );
}

export async function setAllocation(
  categoryId: number,
  month: string,
  amountUSD: number,
  amountBS: number = 0
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO budget_allocations (categoryId, month, amountUSD, amountBS, updatedAt)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(categoryId, month) DO UPDATE SET
       amountUSD = excluded.amountUSD,
       amountBS = excluded.amountBS,
       updatedAt = datetime('now')`,
    [categoryId, month, amountUSD, amountBS]
  );
}

export async function getMonthAllocations(month: string): Promise<BudgetAllocation[]> {
  const db = await getDatabase();
  return await db.getAllAsync<BudgetAllocation>(
    'SELECT * FROM budget_allocations WHERE month = ? ORDER BY categoryId ASC',
    [month]
  );
}

export async function getSpendingByCategory(month: string): Promise<CategorySpending[]> {
  const db = await getDatabase();
  return await db.getAllAsync<CategorySpending>(
    `SELECT
       categoryId,
       COALESCE(SUM(amountUSD), 0) as spentUSD,
       COALESCE(SUM(amountBS), 0) as spentBS
     FROM transactions
     WHERE type = 'expense'
       AND date LIKE ?
     GROUP BY categoryId`,
    [`${month}%`]
  );
}

export async function getGroupSummaries(month: string): Promise<GroupWithCategories[]> {
  const groups = await getGroups('expense');
  const categories = await getCategoriesWithGroups('expense');
  const allocations = await getMonthAllocations(month);
  const spending = await getSpendingByCategory(month);

  const allocMap = new Map(allocations.map((a) => [a.categoryId, a]));
  const spendMap = new Map(spending.map((s) => [s.categoryId, s]));

  // Categorías sin grupo
  const ungroupedCats = categories
    .filter((c) => c.groupId === null)
    .map((c) => ({
      ...c,
      allocation: allocMap.get(c.id),
      spending: spendMap.get(c.id),
    }));

  const result: GroupWithCategories[] = groups.map((group) => {
    const groupCats = categories
      .filter((c) => c.groupId === group.id)
      .map((c) => ({
        ...c,
        allocation: allocMap.get(c.id),
        spending: spendMap.get(c.id),
      }));

    const totalBudgetUSD = groupCats.reduce(
      (sum, c) => sum + (c.allocation?.amountUSD || 0),
      0
    );
    const totalSpentUSD = groupCats.reduce(
      (sum, c) => sum + (c.spending?.spentUSD || 0),
      0
    );

    return {
      group,
      categories: groupCats,
      totalBudgetUSD,
      totalSpentUSD,
    };
  });

  // Agregar categorías sin grupo como un grupo virtual
  if (ungroupedCats.length > 0) {
    result.push({
      group: {
        id: 0,
        name: 'Sin Grupo',
        icon: '📦',
        color: '#6B7280',
        type: 'expense',
        sortOrder: 999,
        createdAt: '',
      },
      categories: ungroupedCats,
      totalBudgetUSD: ungroupedCats.reduce((sum, c) => sum + (c.allocation?.amountUSD || 0), 0),
      totalSpentUSD: ungroupedCats.reduce((sum, c) => sum + (c.spending?.spentUSD || 0), 0),
    });
  }

  return result;
}
