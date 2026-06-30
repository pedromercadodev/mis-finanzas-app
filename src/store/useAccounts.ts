import { create } from 'zustand';
import type { Account } from '../utils/types';
import * as accountsService from '../services/accounts';

interface AccountsState {
  accounts: Account[];
  loading: boolean;
  loadAccounts: () => Promise<void>;
  addAccount: (account: Omit<Account, 'id' | 'createdAt'>) => Promise<number>;
  removeAccount: (id: number) => Promise<void>;
}

export const useAccounts = create<AccountsState>((set) => ({
  accounts: [],
  loading: false,
  loadAccounts: async () => {
    set({ loading: true });
    const accounts = await accountsService.getAccounts();
    set({ accounts, loading: false });
  },
  addAccount: async (account) => {
    const id = await accountsService.createAccount(account);
    await accountsService.getAccounts().then((accounts) => set({ accounts }));
    return id;
  },
  removeAccount: async (id) => {
    await accountsService.deleteAccount(id);
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
    }));
  },
}));
