import { db } from './database';
import type { Category } from '../utils/types';

export interface CategoryBreakdown {
  categoryId: number;
  categoryName: string;
  icon: string;
  color: string;
  totalUSD: number;
  totalBS: number;
  percentage: number;
}

export interface CashFlowPoint {
  date: string;
  incomeUSD: number;
  expenseUSD: number;
  balanceUSD: number;
  incomeBS: number;
  expenseBS: number;
  balanceBS: number;
}

export interface ReportSummary {
  totalIncomeUSD: number;
  totalExpenseUSD: number;
  totalIncomeBS: number;
  totalExpenseBS: number;
  netUSD: number;
  netBS: number;
}

/**
 * Obtiene el desglose de gastos o ingresos agrupados por categoría
 * con sus porcentajes sobre el total del período.
 */
export async function getCategoryBreakdown(
  type: 'income' | 'expense',
  startDate: string,
  endDate: string
): Promise<CategoryBreakdown[]> {
  const transactions = await db.transactions
    .filter((tx) => tx.type === type && tx.date >= startDate && tx.date <= endDate)
    .toArray();

  const categories = await db.categories.toArray();
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Agrupar por categoría
  const breakdownMap = new Map<number, { totalUSD: number; totalBS: number }>();

  for (const tx of transactions) {
    const catId = tx.categoryId;
    if (!breakdownMap.has(catId)) {
      breakdownMap.set(catId, { totalUSD: 0, totalBS: 0 });
    }
    const current = breakdownMap.get(catId)!;
    current.totalUSD += tx.amountUSD || 0;
    current.totalBS += tx.amountBS || 0;
  }

  // Calcular total general para porcentajes
  const grandTotalUSD = Array.from(breakdownMap.values()).reduce((sum, v) => sum + v.totalUSD, 0);
  const grandTotalBS = Array.from(breakdownMap.values()).reduce((sum, v) => sum + v.totalBS, 0);
  const grandTotalCombined = grandTotalUSD + (grandTotalBS > 0 ? grandTotalBS / 100 : 0);

  const result: CategoryBreakdown[] = Array.from(breakdownMap.entries())
    .map(([categoryId, values]) => {
      const cat = catMap.get(categoryId);
      return {
        categoryId,
        categoryName: cat?.name || 'Sin categoría',
        icon: cat?.icon || 'help-outline',
        color: cat?.color || '#999',
        totalUSD: values.totalUSD,
        totalBS: values.totalBS,
        percentage: grandTotalCombined > 0
          ? Math.round(((values.totalUSD + (values.totalBS > 0 ? values.totalBS / 100 : 0)) / grandTotalCombined) * 100)
          : 0,
      };
    })
    .sort((a, b) => b.totalUSD - a.totalUSD);

  return result;
}

/**
 * Obtiene el historial de flujo de caja en un rango de fechas,
 * agrupado por el intervalo especificado.
 */
export async function getCashFlowHistory(
  startDate: string,
  endDate: string,
  interval: 'day' | 'week' | 'month' = 'month'
): Promise<CashFlowPoint[]> {
  const transactions = await db.transactions
    .filter((tx) =>
      tx.date >= startDate &&
      tx.date <= endDate &&
      (tx.type === 'income' || tx.type === 'expense')
    )
    .toArray();

  // Agrupar por período
  const periodMap = new Map<string, { incomeUSD: number; expenseUSD: number; incomeBS: number; expenseBS: number }>();

  for (const tx of transactions) {
    let period: string;
    const d = new Date(tx.date);

    switch (interval) {
      case 'day':
        period = tx.date; // YYYY-MM-DD
        break;
      case 'week': {
        // Obtener número de semana
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
        period = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        break;
      }
      case 'month':
      default:
        period = tx.date.substring(0, 7); // YYYY-MM
        break;
    }

    if (!periodMap.has(period)) {
      periodMap.set(period, { incomeUSD: 0, expenseUSD: 0, incomeBS: 0, expenseBS: 0 });
    }

    const current = periodMap.get(period)!;
    if (tx.type === 'income') {
      current.incomeUSD += tx.amountUSD || 0;
      current.incomeBS += tx.amountBS || 0;
    } else if (tx.type === 'expense') {
      current.expenseUSD += tx.amountUSD || 0;
      current.expenseBS += tx.amountBS || 0;
    }
  }

  // Ordenar por período ascendente
  const sortedPeriods = Array.from(periodMap.keys()).sort();

  let runningBalanceUSD = 0;
  let runningBalanceBS = 0;

  return sortedPeriods.map((period) => {
    const values = periodMap.get(period)!;
    runningBalanceUSD += values.incomeUSD - values.expenseUSD;
    runningBalanceBS += values.incomeBS - values.expenseBS;
    return {
      date: period,
      incomeUSD: values.incomeUSD,
      expenseUSD: values.expenseUSD,
      balanceUSD: runningBalanceUSD,
      incomeBS: values.incomeBS,
      expenseBS: values.expenseBS,
      balanceBS: runningBalanceBS,
    };
  });
}

/**
 * Obtiene un resumen del período: total ingresos, gastos y neto.
 */
export async function getReportSummary(
  startDate: string,
  endDate: string
): Promise<ReportSummary> {
  const transactions = await db.transactions
    .filter((tx) =>
      tx.date >= startDate &&
      tx.date <= endDate &&
      (tx.type === 'income' || tx.type === 'expense')
    )
    .toArray();

  let totalIncomeUSD = 0, totalExpenseUSD = 0;
  let totalIncomeBS = 0, totalExpenseBS = 0;

  for (const tx of transactions) {
    if (tx.type === 'income') {
      totalIncomeUSD += tx.amountUSD || 0;
      totalIncomeBS += tx.amountBS || 0;
    } else if (tx.type === 'expense') {
      totalExpenseUSD += tx.amountUSD || 0;
      totalExpenseBS += tx.amountBS || 0;
    }
  }

  return {
    totalIncomeUSD,
    totalExpenseUSD,
    totalIncomeBS,
    totalExpenseBS,
    netUSD: totalIncomeUSD - totalExpenseUSD,
    netBS: totalIncomeBS - totalExpenseBS,
  };
}
