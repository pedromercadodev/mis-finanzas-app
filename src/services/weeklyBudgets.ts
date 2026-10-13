import { getDatabase } from './database';
import type {
  WeeklyBudget,
  WeeklyAllocation,
  WeeklySummary,
  CategorySpending,
  AllocationAmount,
  GroupWithCategories,
} from '../utils/types';
import { getCategoriesWithGroups } from './categories';
import { getGroups } from './categoryGroups';
import { buildGroupSummaries } from './budgetAllocations';

/**
 * Cabecera del presupuesto de una semana (el "disponible" escrito a mano).
 * `weekKey` es la fecha del viernes de inicio (YYYY-MM-DD).
 */
export async function getWeeklyBudget(weekKey: string): Promise<WeeklyBudget | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<WeeklyBudget>(
    'SELECT * FROM weekly_budgets WHERE weekKey = ?',
    [weekKey]
  );
}

/**
 * Crea o actualiza el disponible de una semana (upsert por `weekKey`).
 */
export async function setWeeklyAvailable(
  weekKey: string,
  startDate: string,
  endDate: string,
  availableUSD: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO weekly_budgets (weekKey, startDate, endDate, availableUSD, updatedAt)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(weekKey) DO UPDATE SET
       startDate = excluded.startDate,
       endDate = excluded.endDate,
       availableUSD = excluded.availableUSD,
       updatedAt = datetime('now')`,
    [weekKey, startDate, endDate, availableUSD]
  );
}

export async function getWeeklyAllocations(weekKey: string): Promise<WeeklyAllocation[]> {
  const db = await getDatabase();
  return await db.getAllAsync<WeeklyAllocation>(
    'SELECT * FROM weekly_allocations WHERE weekKey = ? ORDER BY categoryId ASC',
    [weekKey]
  );
}

/**
 * Crea o actualiza la asignación de una categoría dentro de una semana.
 */
export async function setWeeklyAllocation(
  weekKey: string,
  categoryId: number,
  amountUSD: number,
  amountBS: number = 0
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO weekly_allocations (weekKey, categoryId, amountUSD, amountBS, updatedAt)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(weekKey, categoryId) DO UPDATE SET
       amountUSD = excluded.amountUSD,
       amountBS = excluded.amountBS,
       updatedAt = datetime('now')`,
    [weekKey, categoryId, amountUSD, amountBS]
  );
}

/**
 * Gasto por categoría dentro de un rango de fechas (inclusive).
 */
export async function getSpendingByCategoryRange(
  startDate: string,
  endDate: string
): Promise<CategorySpending[]> {
  const db = await getDatabase();
  return await db.getAllAsync<CategorySpending>(
    `SELECT
       categoryId,
       COALESCE(SUM(amountUSD), 0) as spentUSD,
       COALESCE(SUM(amountBS), 0) as spentBS
     FROM transactions
     WHERE type = 'expense'
       AND date >= ?
       AND date <= ?
     GROUP BY categoryId`,
    [startDate, endDate]
  );
}

/**
 * Resumen completo de una semana: disponible, repartido, gastado, por asignar
 * y los grupos con sus categorías.
 */
export async function getWeeklySummary(
  weekKey: string,
  startDate: string,
  endDate: string
): Promise<WeeklySummary> {
  const budget = await getWeeklyBudget(weekKey);
  const groups = await getGroups('expense');
  const categories = await getCategoriesWithGroups('expense');
  const allocations = await getWeeklyAllocations(weekKey);
  const spending = await getSpendingByCategoryRange(startDate, endDate);

  const allocMap = new Map<number, AllocationAmount>(allocations.map((a) => [a.categoryId, a]));
  const spendMap = new Map<number, CategorySpending>(spending.map((s) => [s.categoryId, s]));

  const groupSummaries: GroupWithCategories[] = buildGroupSummaries(
    groups,
    categories,
    allocMap,
    spendMap
  );

  const availableUSD = budget?.availableUSD || 0;
  const totalAllocatedUSD = groupSummaries.reduce((sum, g) => sum + g.totalBudgetUSD, 0);
  const totalSpentUSD = groupSummaries.reduce((sum, g) => sum + g.totalSpentUSD, 0);

  return {
    weekKey,
    startDate,
    endDate,
    availableUSD,
    totalAllocatedUSD,
    totalSpentUSD,
    remainingUSD: availableUSD - totalAllocatedUSD,
    groups: groupSummaries,
  };
}
