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
