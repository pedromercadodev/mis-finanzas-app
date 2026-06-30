import { getDatabase } from './database';
import type { Debt, DebtPayment, DebtType, DebtStatus } from '../utils/types';

/**
 * Obtiene todas las deudas, opcionalmente filtradas por tipo y/o estado.
 */
export async function getDebts(
  type?: DebtType,
  status?: DebtStatus
): Promise<Debt[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM debts';
  const params: any[] = [];
  const conditions: string[] = [];

  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY createdAt DESC';
  return await db.getAllAsync<Debt>(query, params);
}

/**
 * Obtiene una deuda por su ID.
 */
export async function getDebtById(id: number): Promise<Debt | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<Debt>('SELECT * FROM debts WHERE id = ?', [id]);
}

/**
 * Crea una nueva deuda.
 */
export async function createDebt(
  data: Omit<Debt, 'id' | 'createdAt'>
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO debts (type, personName, description, amountUSD, amountBS, currency, interestRate, totalAmountUSD, totalAmountBS, paidAmountUSD, paidAmountBS, dueDate, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.type,
      data.personName,
      data.description || null,
      data.amountUSD ?? null,
      data.amountBS ?? null,
      data.currency,
      data.interestRate ?? 0,
      data.totalAmountUSD ?? null,
      data.totalAmountBS ?? null,
      data.paidAmountUSD ?? 0,
      data.paidAmountBS ?? 0,
      data.dueDate || null,
      data.status || 'active',
      data.notes || null,
    ]
  );
  return result.lastInsertRowId;
}

/**
 * Actualiza una deuda existente.
 */
export async function updateDebt(
  id: number,
  data: Partial<Debt>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
  if (data.personName !== undefined) { fields.push('personName = ?'); values.push(data.personName); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.amountUSD !== undefined) { fields.push('amountUSD = ?'); values.push(data.amountUSD); }
  if (data.amountBS !== undefined) { fields.push('amountBS = ?'); values.push(data.amountBS); }
  if (data.currency !== undefined) { fields.push('currency = ?'); values.push(data.currency); }
  if (data.interestRate !== undefined) { fields.push('interestRate = ?'); values.push(data.interestRate); }
  if (data.totalAmountUSD !== undefined) { fields.push('totalAmountUSD = ?'); values.push(data.totalAmountUSD); }
  if (data.totalAmountBS !== undefined) { fields.push('totalAmountBS = ?'); values.push(data.totalAmountBS); }
  if (data.paidAmountUSD !== undefined) { fields.push('paidAmountUSD = ?'); values.push(data.paidAmountUSD); }
  if (data.paidAmountBS !== undefined) { fields.push('paidAmountBS = ?'); values.push(data.paidAmountBS); }
  if (data.dueDate !== undefined) { fields.push('dueDate = ?'); values.push(data.dueDate); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }

  if (fields.length > 0) {
    values.push(id);
    await db.runAsync(`UPDATE debts SET ${fields.join(', ')} WHERE id = ?`, values);
  }
}

/**
 * Elimina una deuda y sus pagos asociados (CASCADE).
 */
export async function deleteDebt(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM debts WHERE id = ?', [id]);
}

/**
 * Obtiene los pagos de una deuda.
 */
export async function getDebtPayments(debtId: number): Promise<DebtPayment[]> {
  const db = await getDatabase();
  return await db.getAllAsync<DebtPayment>(
    'SELECT * FROM debt_payments WHERE debtId = ? ORDER BY date DESC',
    [debtId]
  );
}

/**
 * Registra un pago/abono a una deuda y actualiza paidAmount y status.
 */
export async function recordPayment(
  debtId: number,
  amountUSD: number,
  amountBS: number,
  date: string,
  notes?: string
): Promise<number> {
  const db = await getDatabase();

  // Insertar el pago
  const result = await db.runAsync(
    `INSERT INTO debt_payments (debtId, amountUSD, amountBS, date, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [debtId, amountUSD, amountBS, date, notes || null]
  );

  // Actualizar paidAmount en la deuda
  const debt = await getDebtById(debtId);
  if (debt) {
    const newPaidUSD = (debt.paidAmountUSD || 0) + amountUSD;
    const newPaidBS = (debt.paidAmountBS || 0) + amountBS;

    // Determinar si está totalmente pagado
    let newStatus: DebtStatus = debt.status;
    const totalUSD = debt.totalAmountUSD || debt.amountUSD || 0;
    const totalBS = debt.totalAmountBS || debt.amountBS || 0;

    if (totalUSD > 0 && newPaidUSD >= totalUSD) {
      newStatus = 'paid';
    } else if (totalBS > 0 && newPaidBS >= totalBS) {
      newStatus = 'paid';
    }

    await updateDebt(debtId, {
      paidAmountUSD: newPaidUSD,
      paidAmountBS: newPaidBS,
      status: newStatus,
    });
  }

  return result.lastInsertRowId;
}

/**
 * Obtiene un resumen de todas las deudas.
 */
export async function getDebtSummary(): Promise<{
  totalLentUSD: number;
  totalLentBS: number;
  totalBorrowedUSD: number;
  totalBorrowedBS: number;
  netBalanceUSD: number;
  netBalanceBS: number;
  activeLentCount: number;
  activeBorrowedCount: number;
}> {
  const db = await getDatabase();

  const lentResult = await db.getFirstAsync<{
    totalUSD: number | null;
    totalBS: number | null;
    count: number;
  }>(
    `SELECT
       COALESCE(SUM(COALESCE(totalAmountUSD, amountUSD, 0)), 0) as totalUSD,
       COALESCE(SUM(COALESCE(totalAmountBS, amountBS, 0)), 0) as totalBS,
       COUNT(*) as count
     FROM debts
     WHERE type = 'lent' AND status = 'active'`
  );

  const borrowedResult = await db.getFirstAsync<{
    totalUSD: number | null;
    totalBS: number | null;
    count: number;
  }>(
    `SELECT
       COALESCE(SUM(COALESCE(totalAmountUSD, amountUSD, 0)), 0) as totalUSD,
       COALESCE(SUM(COALESCE(totalAmountBS, amountBS, 0)), 0) as totalBS,
       COUNT(*) as count
     FROM debts
     WHERE type = 'borrowed' AND status = 'active'`
  );

  return {
    totalLentUSD: lentResult?.totalUSD ?? 0,
    totalLentBS: lentResult?.totalBS ?? 0,
    totalBorrowedUSD: borrowedResult?.totalUSD ?? 0,
    totalBorrowedBS: borrowedResult?.totalBS ?? 0,
    netBalanceUSD: (lentResult?.totalUSD ?? 0) - (borrowedResult?.totalUSD ?? 0),
    netBalanceBS: (lentResult?.totalBS ?? 0) - (borrowedResult?.totalBS ?? 0),
    activeLentCount: lentResult?.count ?? 0,
    activeBorrowedCount: borrowedResult?.count ?? 0,
  };
}
