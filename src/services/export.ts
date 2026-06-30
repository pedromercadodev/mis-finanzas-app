import { getTransactions } from './transactions';
import { getAccountById } from './accounts';
import { getCategories } from './categories';

export interface ExportOptions {
  startDate?: string;
  endDate?: string;
  accountId?: number;
  format: 'csv' | 'json';
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function generateCSV(options?: ExportOptions): Promise<string> {
  const transactions = await getTransactions({
    ...(options?.accountId ? { accountId: options.accountId } : {}),
  });

  // Filtrar por rango de fechas si se especifica
  let filtered = transactions;
  if (options?.startDate) {
    filtered = filtered.filter((tx) => tx.date >= options.startDate!);
  }
  if (options?.endDate) {
    filtered = filtered.filter((tx) => tx.date <= options.endDate!);
  }

  // Obtener nombres de cuentas y categorías para el CSV
  const accountCache = new Map<number, string>();
  const categoryCache = new Map<number, string>();

  for (const tx of filtered) {
    if (!accountCache.has(tx.accountId)) {
      const acc = await getAccountById(tx.accountId);
      accountCache.set(tx.accountId, acc?.name || 'Desconocida');
    }
    if (!categoryCache.has(tx.categoryId)) {
      const cats = await getCategories();
      const cat = cats.find((c) => c.id === tx.categoryId);
      categoryCache.set(tx.categoryId, cat?.name || 'Desconocida');
    }
  }

  const headers = [
    'Fecha',
    'Tipo',
    'Descripción',
    'Monto USD',
    'Monto BS',
    'Tasa Cambio',
    'Categoría',
    'Cuenta',
    'Notas',
  ];

  const rows = filtered.map((tx) =>
    [
      tx.date,
      tx.type === 'income' ? 'Ingreso' : tx.type === 'expense' ? 'Gasto' : 'Transferencia',
      tx.description,
      tx.amountUSD?.toFixed(2) || '',
      tx.amountBS?.toFixed(2) || '',
      tx.exchangeRate?.toFixed(2) || '',
      categoryCache.get(tx.categoryId) || '',
      accountCache.get(tx.accountId) || '',
      tx.notes || '',
    ]
      .map(escapeCSV)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

async function generateJSON(options?: ExportOptions): Promise<string> {
  const transactions = await getTransactions({
    ...(options?.accountId ? { accountId: options.accountId } : {}),
  });

  let filtered = transactions;
  if (options?.startDate) {
    filtered = filtered.filter((tx) => tx.date >= options.startDate!);
  }
  if (options?.endDate) {
    filtered = filtered.filter((tx) => tx.date <= options.endDate!);
  }

  // Enriquecer con nombres de cuenta y categoría
  const enriched = await Promise.all(
    filtered.map(async (tx) => {
      const account = await getAccountById(tx.accountId);
      const cats = await getCategories();
      const category = cats.find((c) => c.id === tx.categoryId);
      return {
        date: tx.date,
        type: tx.type,
        description: tx.description,
        amountUSD: tx.amountUSD,
        amountBS: tx.amountBS,
        exchangeRate: tx.exchangeRate,
        category: category?.name || null,
        account: account?.name || null,
        notes: tx.notes,
      };
    })
  );

  return JSON.stringify(enriched, null, 2);
}

export async function exportData(options: ExportOptions): Promise<string> {
  const content =
    options.format === 'csv' ? await generateCSV(options) : await generateJSON(options);

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `transacciones_${dateStr}.${options.format}`;

  // En web, usar FileSaver o descarga directa
  const blob = new Blob([content], {
    type: options.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return fileName;
}

export async function shareFile(fileUri: string): Promise<void> {
  // En web, la descarga ya se manejó en exportData
  // Esta función se mantiene para compatibilidad
  console.log('Archivo descargado:', fileUri);
}
