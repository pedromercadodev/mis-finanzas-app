import { db } from './database';
import type { Debt, DebtPayment, DebtType, DebtStatus } from '../utils/types';

/**
 * Obtiene todas las deudas, opcionalmente filtradas por tipo y/o estado.
 */
export async function getDebts(
  type?: DebtType,
  status?: DebtStatus
): Promise<Debt[]> {
  let results = await db.debts.toArray();

  if (type) {
    results = results.filter((d) => d.type === type);
  }
  if (status) {
    results = results.filter((d) => d.status === status);
  }

  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return results;
}

/**
 * Obtiene una deuda por su ID.
 */
export async function getDebtById(id: number): Promise<Debt | null> {
  return (await db.debts.get(id)) ?? null;
}

/**
 * Crea una nueva deuda.
 */
export async function createDebt(
  data: Omit<Debt, 'id' | 'createdAt'>
): Promise<number> {
  const now = new Date().toISOString();
  const id = await db.debts.add({
    ...data,
    description: data.description ?? null,
    amountUSD: data.amountUSD ?? null,
    amountBS: data.amountBS ?? null,
    interestRate: data.interestRate ?? 0,
    totalAmountUSD: data.totalAmountUSD ?? null,
    totalAmountBS: data.totalAmountBS ?? null,
    paidAmountUSD: data.paidAmountUSD ?? 0,
    paidAmountBS: data.paidAmountBS ?? 0,
    dueDate: data.dueDate ?? null,
    status: data.status || 'active',
    notes: data.notes ?? null,
    createdAt: now,
  } as Debt);
  return id;
}

/**
 * Actualiza una deuda existente.
 */
export async function updateDebt(
  id: number,
  data: Partial<Debt>
): Promise<void> {
  await db.debts.update(id, data);
}

/**
 * Elimina una deuda y sus pagos asociados.
 */
export async function deleteDebt(id: number): Promise<void> {
  // Eliminar pagos asociados
  const payments = await db.debtPayments.where('debtId').equals(id).toArray();
  for (const p of payments) {
    await db.debtPayments.delete(p.id);
  }
  await db.debts.delete(id);
}

/**
 * Obtiene los pagos de una deuda.
 */
export async function getDebtPayments(debtId: number): Promise<DebtPayment[]> {
  return await db.debtPayments
    .where('debtId')
    .equals(debtId)
    .reverse()
    .sortBy('date');
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
  const now = new Date().toISOString();

  // Insertar el pago
  const paymentId = await db.debtPayments.add({
    debtId,
    amountUSD,
    amountBS,
    date,
    notes: notes ?? null,
    createdAt: now,
  } as DebtPayment);

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

  return paymentId;
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
  const allDebts = await db.debts.toArray();

  const activeLent = allDebts.filter((d) => d.type === 'lent' && d.status === 'active');
  const activeBorrowed = allDebts.filter((d) => d.type === 'borrowed' && d.status === 'active');

  const totalLentUSD = activeLent.reduce(
    (sum, d) => sum + (d.totalAmountUSD || d.amountUSD || 0), 0
  );
  const totalLentBS = activeLent.reduce(
    (sum, d) => sum + (d.totalAmountBS || d.amountBS || 0), 0
  );
  const totalBorrowedUSD = activeBorrowed.reduce(
    (sum, d) => sum + (d.totalAmountUSD || d.amountUSD || 0), 0
  );
  const totalBorrowedBS = activeBorrowed.reduce(
    (sum, d) => sum + (d.totalAmountBS || d.amountBS || 0), 0
  );

  return {
    totalLentUSD,
    totalLentBS,
    totalBorrowedUSD,
    totalBorrowedBS,
    netBalanceUSD: totalLentUSD - totalBorrowedUSD,
    netBalanceBS: totalLentBS - totalBorrowedBS,
    activeLentCount: activeLent.length,
    activeBorrowedCount: activeBorrowed.length,
  };
}
