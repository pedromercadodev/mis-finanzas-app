import { db } from './database';
import { createTransaction } from './transactions';
import type { Subscription } from '../utils/types';

/**
 * Obtiene todas las suscripciones, opcionalmente solo las activas.
 */
export async function getSubscriptions(activeOnly = false): Promise<Subscription[]> {
  let collection = db.subscriptions.orderBy('nextBillingDate');

  if (activeOnly) {
    collection = collection.filter((s) => s.isActive === 1) as any;
  }

  return await collection.toArray();
}

/**
 * Obtiene una suscripción por su ID.
 */
export async function getSubscriptionById(id: number): Promise<Subscription | null> {
  return (await db.subscriptions.get(id)) ?? null;
}

/**
 * Crea una nueva suscripción.
 */
export async function createSubscription(
  data: Omit<Subscription, 'id' | 'createdAt'>
): Promise<number> {
  const now = new Date().toISOString();
  const id = await db.subscriptions.add({
    ...data,
    description: data.description ?? null,
    amountUSD: data.amountUSD ?? null,
    amountBS: data.amountBS ?? null,
    intervalDays: data.intervalDays ?? null,
    notes: data.notes ?? null,
    createdAt: now,
  } as Subscription);
  return id;
}

/**
 * Actualiza una suscripción existente.
 */
export async function updateSubscription(
  id: number,
  data: Partial<Subscription>
): Promise<void> {
  await db.subscriptions.update(id, data);
}

/**
 * Elimina una suscripción.
 */
export async function deleteSubscription(id: number): Promise<void> {
  await db.subscriptions.delete(id);
}

/**
 * Obtiene las suscripciones cuya próxima fecha de cobro ya pasó o vence en los próximos `daysAhead` días.
 */
export async function getDueSubscriptions(daysAhead = 0): Promise<Subscription[]> {
  const today = new Date().toISOString().split('T')[0];

  // Fecha límite: hoy + daysAhead días
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + daysAhead);
  const limitDateStr = limitDate.toISOString().split('T')[0];

  const all = await db.subscriptions.toArray();
  return all
    .filter((s) => s.isActive === 1 && s.nextBillingDate <= limitDateStr)
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));
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
