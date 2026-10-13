/**
 * Funciones de utilidad para manejo de fechas.
 * Venezuela está en UTC-4, por lo que todas las fechas locales
 * deben ajustarse restando 4 horas a UTC.
 */

const UTC_OFFSET = -4; // Venezuela (UTC-4)

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD ajustada a UTC-4 (Venezuela).
 * Útil para guardar transacciones con la fecha local correcta.
 */
export function getLocalDateString(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() + UTC_OFFSET * 60 * 60 * 1000);
  return localDate.toISOString().split('T')[0];
}

/**
 * Obtiene un objeto Date ajustado a UTC-4 (Venezuela).
 */
export function getLocalDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + UTC_OFFSET * 60 * 60 * 1000);
}

/**
 * Obtiene el año y mes local en formato YYYY-MM.
 */
export function getLocalMonth(): string {
  const localDate = getLocalDate();
  return `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Rango de una semana (viernes a jueves).
 * `weekKey` es la fecha del viernes de inicio en formato YYYY-MM-DD.
 */
export interface WeekRange {
  weekKey: string;
  startDate: string;
  endDate: string;
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Obtiene la **semana activa**: la del **próximo viernes** (el primer viernes
 * mayor o igual a hoy). El rango va de viernes a jueves (7 días).
 *
 * Ejemplo: lunes 2026-10-12 → Viernes 2026-10-16 (Jueves 2026-10-22).
 * Si hoy es viernes, la semana empieza ese mismo día.
 *
 * @param ref Fecha de referencia ya ajustada a UTC-4 (por defecto, hoy local).
 */
export function getWeekRange(ref?: Date): WeekRange {
  const base = ref ?? getLocalDate();
  const day = base.getUTCDay(); // 0 = domingo ... 6 = sábado
  const offsetToFriday = (5 - day + 7) % 7;
  const start = addDays(base, offsetToFriday);
  const end = addDays(start, 6);
  return {
    weekKey: toDateString(start),
    startDate: toDateString(start),
    endDate: toDateString(end),
  };
}

/**
 * Desplaza un rango de semana `deltaWeeks` semanas (negativo = anterior).
 */
export function shiftWeekRange(range: WeekRange, deltaWeeks: number): WeekRange {
  const start = new Date(`${range.startDate}T00:00:00.000Z`);
  const newStart = addDays(start, deltaWeeks * 7);
  const newEnd = addDays(newStart, 6);
  return {
    weekKey: toDateString(newStart),
    startDate: toDateString(newStart),
    endDate: toDateString(newEnd),
  };
}

/**
 * Etiqueta legible de la semana, ej. `Vie 16 – Jue 22 oct`.
 */
export function formatWeekLabel(startDate: string, endDate: string): string {
  const s = new Date(`${startDate}T00:00:00.000Z`);
  const e = new Date(`${endDate}T00:00:00.000Z`);
  return `${DAY_LABELS[s.getUTCDay()]} ${s.getUTCDate()} – ${DAY_LABELS[e.getUTCDay()]} ${e.getUTCDate()} ${MONTH_SHORT[e.getUTCMonth()]}`;
}

/**
 * Indica si el rango corresponde a la semana activa (la del próximo viernes).
 */
export function isCurrentWeek(range: WeekRange): boolean {
  return range.weekKey === getWeekRange().weekKey;
}
