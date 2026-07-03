import { getDatabase } from './database';
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

export interface PeriodComparison {
  incomeChange: number | null;   // porcentaje de cambio vs período anterior
  expenseChange: number | null;
  netChange: number | null;
  previousIncomeUSD: number;
  previousExpenseUSD: number;
  previousNetUSD: number;
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
  const db = await getDatabase();

  const rows = await db.getAllAsync<any>(
    `SELECT
       c.id as categoryId,
       c.name as categoryName,
       c.icon,
       c.color,
       COALESCE(SUM(COALESCE(t.amountUSD, 0)), 0) as totalUSD,
       COALESCE(SUM(COALESCE(t.amountBS, 0)), 0) as totalBS
     FROM transactions t
     LEFT JOIN categories c ON t.categoryId = c.id
     WHERE t.type = ?
       AND t.date >= ?
       AND t.date <= ?
     GROUP BY c.id
     ORDER BY totalUSD DESC, totalBS DESC`,
    [type, startDate, endDate]
  );

  // Calcular total general para porcentajes
  const grandTotalUSD = rows.reduce((sum: number, r: any) => sum + r.totalUSD, 0);
  const grandTotalBS = rows.reduce((sum: number, r: any) => sum + r.totalBS, 0);

  // Usar el total combinado (USD + BS convertido aproximado) para el %
  const grandTotalCombined = grandTotalUSD + (grandTotalBS > 0 ? grandTotalBS / 100 : 0);

  return rows.map((row: any) => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName || 'Sin categoría',
    icon: row.icon || 'help-outline',
    color: row.color || '#999',
    totalUSD: row.totalUSD,
    totalBS: row.totalBS,
    percentage: grandTotalCombined > 0
      ? Math.round(((row.totalUSD + (row.totalBS > 0 ? row.totalBS / 100 : 0)) / grandTotalCombined) * 100)
      : 0,
  }));
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
  const db = await getDatabase();

  let dateFormat: string;
  switch (interval) {
    case 'day':
      dateFormat = '%Y-%m-%d';
      break;
    case 'week':
      dateFormat = '%Y-%W';
      break;
    case 'month':
    default:
      dateFormat = '%Y-%m';
      break;
  }

  const rows = await db.getAllAsync<any>(
    `SELECT
       strftime('${dateFormat}', t.date) as period,
       COALESCE(SUM(CASE WHEN t.type = 'income' THEN COALESCE(t.amountUSD, 0) ELSE 0 END), 0) as incomeUSD,
       COALESCE(SUM(CASE WHEN t.type = 'expense' THEN COALESCE(t.amountUSD, 0) ELSE 0 END), 0) as expenseUSD,
       COALESCE(SUM(CASE WHEN t.type = 'income' THEN COALESCE(t.amountBS, 0) ELSE 0 END), 0) as incomeBS,
       COALESCE(SUM(CASE WHEN t.type = 'expense' THEN COALESCE(t.amountBS, 0) ELSE 0 END), 0) as expenseBS
     FROM transactions t
     WHERE t.date >= ?
       AND t.date <= ?
       AND t.type IN ('income', 'expense')
     GROUP BY period
     ORDER BY period ASC`,
    [startDate, endDate]
  );

  let runningBalanceUSD = 0;
  let runningBalanceBS = 0;

  return rows.map((row: any) => {
    runningBalanceUSD += row.incomeUSD - row.expenseUSD;
    runningBalanceBS += row.incomeBS - row.expenseBS;
    return {
      date: row.period,
      incomeUSD: row.incomeUSD,
      expenseUSD: row.expenseUSD,
      balanceUSD: runningBalanceUSD,
      incomeBS: row.incomeBS,
      expenseBS: row.expenseBS,
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
  const db = await getDatabase();

  const result = await db.getFirstAsync<any>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income' THEN COALESCE(amountUSD, 0) ELSE 0 END), 0) as totalIncomeUSD,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN COALESCE(amountUSD, 0) ELSE 0 END), 0) as totalExpenseUSD,
       COALESCE(SUM(CASE WHEN type = 'income' THEN COALESCE(amountBS, 0) ELSE 0 END), 0) as totalIncomeBS,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN COALESCE(amountBS, 0) ELSE 0 END), 0) as totalExpenseBS
     FROM transactions
     WHERE date >= ?
       AND date <= ?
       AND type IN ('income', 'expense')`,
    [startDate, endDate]
  );

  return {
    totalIncomeUSD: result?.totalIncomeUSD || 0,
    totalExpenseUSD: result?.totalExpenseUSD || 0,
    totalIncomeBS: result?.totalIncomeBS || 0,
    totalExpenseBS: result?.totalExpenseBS || 0,
    netUSD: (result?.totalIncomeUSD || 0) - (result?.totalExpenseUSD || 0),
    netBS: (result?.totalIncomeBS || 0) - (result?.totalExpenseBS || 0),
  };
}

/**
 * Calcula el rango de fechas del período anterior basado en el período actual.
 */
export function getPreviousPeriodRange(
  period: 'month' | 'quarter' | 'year' | 'all'
): { start: string; end: string } | null {
  const now = new Date();

  switch (period) {
    case 'month': {
      // Mes anterior: retroceder 1 mes
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0); // último día del mes anterior
      return {
        start: prev.toISOString().split('T')[0],
        end: prevEnd.toISOString().split('T')[0],
      };
    }
    case 'quarter': {
      // Trimestre anterior: retroceder 3 meses
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: prevStart.toISOString().split('T')[0],
        end: prevEnd.toISOString().split('T')[0],
      };
    }
    case 'year': {
      // Año anterior
      return {
        start: `${now.getFullYear() - 1}-01-01`,
        end: `${now.getFullYear() - 1}-12-31`,
      };
    }
    case 'all':
    default:
      return null; // No hay período anterior para "todo"
  }
}

/**
 * Obtiene la comparativa con el período anterior.
 * Calcula el cambio porcentual para ingresos, gastos y neto.
 */
export async function getPeriodComparison(
  period: 'month' | 'quarter' | 'year' | 'all',
  currentIncomeUSD?: number,
  currentExpenseUSD?: number,
  currentNetUSD?: number
): Promise<PeriodComparison> {
  const prevRange = getPreviousPeriodRange(period);

  if (!prevRange) {
    return {
      incomeChange: null,
      expenseChange: null,
      netChange: null,
      previousIncomeUSD: 0,
      previousExpenseUSD: 0,
      previousNetUSD: 0,
    };
  }

  const prevSummary = await getReportSummary(prevRange.start, prevRange.end);

  const calcChange = (current: number, previous: number): number | null => {
    if (previous === 0) return current > 0 ? 100 : null;
    return Math.round(((current - previous) / previous) * 100);
  };

  return {
    incomeChange: currentIncomeUSD !== undefined ? calcChange(currentIncomeUSD, prevSummary.totalIncomeUSD) : null,
    expenseChange: currentExpenseUSD !== undefined ? calcChange(currentExpenseUSD, prevSummary.totalExpenseUSD) : null,
    netChange: currentNetUSD !== undefined ? calcChange(currentNetUSD, prevSummary.netUSD) : null,
    previousIncomeUSD: prevSummary.totalIncomeUSD,
    previousExpenseUSD: prevSummary.totalExpenseUSD,
    previousNetUSD: prevSummary.netUSD,
  };
}
