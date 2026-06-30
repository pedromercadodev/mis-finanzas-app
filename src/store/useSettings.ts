import { create } from 'zustand';
import type { RateType } from '../utils/types';

interface SettingsState {
  deepseekKey: string;
  manualRate: number | null;
  useDarkMode: boolean;
  preferredRateType: RateType; // 'BCV' | 'PARALLEL' - para calcular BS total
  setDeepseekKey: (key: string) => void;
  setManualRate: (rate: number | null) => void;
  setUseDarkMode: (use: boolean) => void;
  setPreferredRateType: (type: RateType) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  deepseekKey: '',
  manualRate: null,
  useDarkMode: false,
  preferredRateType: 'PARALLEL',
  setDeepseekKey: (key) => set({ deepseekKey: key }),
  setManualRate: (rate) => set({ manualRate: rate }),
  setUseDarkMode: (use) => set({ useDarkMode: use }),
  setPreferredRateType: (type) => set({ preferredRateType: type }),
}));
