export function formatUSD(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '';
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatBS(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '';
  return `Bs ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

export function getMonthName(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export function convertUSToBS(usd: number, rate: number): number {
  return usd * rate;
}

export function convertBSToUS(bs: number, rate: number): number {
  return bs / rate;
}
