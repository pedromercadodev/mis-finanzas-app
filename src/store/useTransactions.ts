import { create } from 'zustand';
import type { Transaction } from '../utils/types';
import * as transactionsService from '../services/transactions';

interface TransactionsState {
  transactions: Transaction[];
  loading: boolean;
  loadTransactions: (options?: { accountId?: number; month?: string; limit?: number }) => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<number>;
  removeTransaction: (id: number) => Promise<void>;
}

export const useTransactions = create<TransactionsState>((set) => ({
  transactions: [],
  loading: false,
  loadTransactions: async (options) => {
    set({ loading: true });
    const transactions = await transactionsService.getTransactions(options);
    set({ transactions, loading: false });
  },
  addTransaction: async (tx) => {
    const id = await transactionsService.createTransaction(tx);
    await transactionsService.getTransactions({ limit: 50 }).then((transactions) => set({ transactions }));
    return id;
  },
  removeTransaction: async (id) => {
    await transactionsService.deleteTransaction(id);
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
    }));
  },
}));
