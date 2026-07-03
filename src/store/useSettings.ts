import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RateType } from '../utils/types';

export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  deepseekKey: string;
  manualRate: number | null;
  manualRateType: RateType; // 'BCV' | 'PARALLEL' - qué tasa reemplaza la manual
  useDarkMode: boolean;
  themeMode: ThemeMode; // 'light' | 'dark' | 'system'
  preferredRateType: RateType; // 'BCV' | 'PARALLEL' - para calcular BS total
  setDeepseekKey: (key: string) => void;
  setManualRate: (rate: number | null) => void;
  setManualRateType: (type: RateType) => void;
  setUseDarkMode: (use: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setPreferredRateType: (type: RateType) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      deepseekKey: '',
      manualRate: null,
      manualRateType: 'PARALLEL',
      useDarkMode: false,
      themeMode: 'system',
      preferredRateType: 'PARALLEL',
      setDeepseekKey: (key) => set({ deepseekKey: key }),
      setManualRate: (rate) => set({ manualRate: rate }),
      setManualRateType: (type) => set({ manualRateType: type }),
      setUseDarkMode: (use) => set({ useDarkMode: use }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      setPreferredRateType: (type) => set({ preferredRateType: type }),
    }),
    {
      name: 'finanzas-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
