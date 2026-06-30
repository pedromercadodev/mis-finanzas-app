import { getDatabase } from './database';
import { createTransaction } from './transactions';
import type { Subscription } from '../utils/types';

/**
 * Obtiene todas las suscripciones, opcionalmente solo las activas.
 */
export async function getSubscriptions(activeOnly = false): Promise<Subscription[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM subscriptions';
  const params: any[] = [];

  if (activeOnly) {
    query += ' WHERE isActive = 1';
  }

  query += ' ORDER BY nextBillingDate ASC';
  return await db.getAllAsync<Subscription>(query, params);
}

/**
 * Obtiene una suscripción por su ID.
 */
export async function getSubscriptionById(id: number): Promise<Subscription | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<Subscription>('SELECT * FROM subscriptions WHERE id = ?', [id]);
}

/**
 * Crea una nueva suscripción.
 */
export async function createSubscription(
  data: Omit<Subscription, 'id' | 'createdAt'>
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO subscriptions (name, description, amountUSD, amountBS, currency, categoryId, accountId, frequency, intervalDays, billingDay, nextBillingDate, isActive, autoGenerate, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.description || null,
      data.amountUSD ?? null,
      data.amountBS ?? null,
      data.currency,
      data.categoryId,
      data.accountId,
      data.frequency,
      data.intervalDays ?? null,
      data.billingDay,
      data.nextBillingDate,
      data.isActive,
      data.autoGenerate,
      data.notes || null,
    ]
  );
  return result.lastInsertRowId;
}

/**
 * Actualiza una suscripción existente.
 */
export async function updateSubscription(
  id: number,
  data: Partial<Subscription>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.amountUSD !== undefined) { fields.push('amountUSD = ?'); values.push(data.amountUSD); }
  if (data.amountBS !== undefined) { fields.push('amountBS = ?'); values.push(data.amountBS); }
  if (data.currency !== undefined) { fields.push('currency = ?'); values.push(data.currency); }
  if (data.categoryId !== undefined) { fields.push('categoryId = ?'); values.push(data.categoryId); }
  if (data.accountId !== undefined) { fields.push('accountId = ?'); values.push(data.accountId); }
  if (data.frequency !== undefined) { fields.push('frequency = ?'); values.push(data.frequency); }
  if (data.intervalDays !== undefined) { fields.push('intervalDays = ?'); values.push(data.intervalDays); }
  if (data.billingDay !== undefined) { fields.push('billingDay = ?'); values.push(data.billingDay); }
  if (data.nextBillingDate !== undefined) { fields.push('nextBillingDate = ?'); values.push(data.nextBillingDate); }
  if (data.isActive !== undefined) { fields.push('isActive = ?'); values.push(data.isActive); }
  if (data.autoGenerate !== undefined) { fields.push('autoGenerate = ?'); values.push(data.autoGenerate); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }

  if (fields.length > 0) {
    values.push(id);
    await db.runAsync(`UPDATE subscriptions SET ${fields.join(', ')} WHERE id = ?`, values);
  }
}

/**
 * Elimina una suscripción.
 */
export async function deleteSubscription(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM subscriptions WHERE id = ?', [id]);
}

/**
 * Obtiene las suscripciones cuya próxima fecha de cobro ya pasó o vence en los próximos `daysAhead` días.
 */
export async function getDueSubscriptions(daysAhead = 0): Promise<Subscription[]> {
  const db = await getDatabase();
  const today = new Date().toISOString().split('T')[0];

  // Fecha límite: hoy + daysAhead días
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + daysAhead);
  const limitDateStr = limitDate.toISOString().split('T')[0];

  return await db.getAllAsync<Subscription>(
    `SELECT * FROM subscriptions
     WHERE isActive = 1
       AND nextBillingDate <= ?
     ORDER BY nextBillingDate ASC`,
    [limitDateStr]
  );
}

/**
 * Calcula la próxima fecha de cobro según la frecuencia de la suscripción.
 */
export function calculateNextBillingDate(subscription: Subscription): string {
  const currentDate = new Date(subscription.nextBillingDate);
  let nextDate: Date;

  switch (subscription.frequency) {
    case 'weekly': {
      nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    }
    case 'monthly': {
      nextDate = new Date(currentDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
      // Si billingDay es específico, ajustar a ese día
      if (subscription.billingDay > 0) {
        nextDate.setDate(subscription.billingDay);
        // Si nos pasamos al mes siguiente, restar un mes
        if (nextDate.getDate() !== subscription.billingDay) {
          nextDate.setDate(0); // Último día del mes anterior
        }
      }
      break;
    }
    case 'yearly': {
      nextDate = new Date(currentDate);
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    }
    case 'custom': {
      nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + (subscription.intervalDays || 30));
      break;
    }
    default: {
      nextDate = new Date(currentDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    }
  }

  return nextDate.toISOString().split('T')[0];
}

/**
 * Procesa las suscripciones vencidas:
 * - Si autoGenerate=1: crea una transacción y actualiza nextBillingDate
 * - Si autoGenerate=0: solo se listan como pendientes (el usuario decide)
 * Retorna las suscripciones que fueron procesadas (auto-generadas).
 */
export async function processDueSubscriptions(): Promise<Subscription[]> {
  const dueSubscriptions = await getDueSubscriptions(0);
  const processed: Subscription[] = [];

  for (const sub of dueSubscriptions) {
    if (sub.autoGenerate) {
      try {
        // Crear transacción automática
        await createTransaction({
          type: 'expense',
          description: `${sub.name}${sub.description ? ' - ' + sub.description : ''}`,
          amountUSD: sub.amountUSD,
          amountBS: sub.amountBS,
          currency: sub.currency,
          exchangeRate: null,
          accountId: sub.accountId,
          transferToAccountId: null,
          categoryId: sub.categoryId,
          date: sub.nextBillingDate,
          notes: `Generado automáticamente por suscripción: ${sub.name}`,
        });

        // Calcular próxima fecha de cobro
        const nextDate = calculateNextBillingDate(sub);

        // Actualizar la suscripción
        await updateSubscription(sub.id, { nextBillingDate: nextDate });

        processed.push(sub);
      } catch (error) {
        console.error(`Error processing subscription ${sub.id} (${sub.name}):`, error);
      }
    }
  }

  return processed;
}
