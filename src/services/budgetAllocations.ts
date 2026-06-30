import { db } from './database';
import type { BudgetAllocation, CategorySpending, GroupWithCategories, CategoryWithGroup } from '../utils/types';
import { getCategoriesWithGroups } from './categories';
import { getGroups } from './categoryGroups';

export async function getAllocation(categoryId: number, month: string): Promise<BudgetAllocation | null> {
  const allocation = await db.budgetAllocations
    .where(['categoryId', 'month'])
    .equals([categoryId, month])
    .first();
  return allocation ?? null;
}

export async function setAllocation(
  categoryId: number,
  month: string,
  amountUSD: number,
  amountBS: number = 0
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getAllocation(categoryId, month);

  if (existing) {
    await db.budgetAllocations.update(existing.id, {
      amountUSD,
      amountBS,
      updatedAt: now,
    });
  } else {
    await db.budgetAllocations.add({
      categoryId,
      month,
      amountUSD,
      amountBS,
      createdAt: now,
      updatedAt: now,
    } as BudgetAllocation);
  }
}

export async function getMonthAllocations(month: string): Promise<BudgetAllocation[]> {
  return await db.budgetAllocations
    .where('month')
    .equals(month)
    .toArray();
}

export async function getSpendingByCategory(month: string): Promise<CategorySpending[]> {
  const transactions = await db.transactions
    .filter((tx) => tx.type === 'expense' && tx.date.startsWith(month))
    .toArray();

  const spendingMap = new Map<number, { spentUSD: number; spentBS: number }>();

  for (const tx of transactions) {
    const catId = tx.categoryId;
    if (!spendingMap.has(catId)) {
      spendingMap.set(catId, { spentUSD: 0, spentBS: 0 });
    }
    const current = spendingMap.get(catId)!;
    current.spentUSD += tx.amountUSD || 0;
    current.spentBS += tx.amountBS || 0;
  }

  return Array.from(spendingMap.entries()).map(([categoryId, values]) => ({
    categoryId,
    spentUSD: values.spentUSD,
    spentBS: values.spentBS,
  }));
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
