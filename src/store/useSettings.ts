import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RateType } from '../utils/types';

export type ThemeMode = 'light' | 'dark' | 'system';

const SECURE_KEY_KEY = 'finanzas-deepseek-key';

// Módulo SecureStore con carga diferida para evitar crash si el módulo nativo no está disponible
let SecureStoreModule: typeof import('expo-secure-store') | null = null;
try {
  SecureStoreModule = require('expo-secure-store');
} catch {
  // Módulo nativo no disponible (ej: desarrollo sin build nativo)
}

interface SettingsState {
  deepseekKey: string;
  manualRate: number | null;
  manualRateType: RateType;
  useDarkMode: boolean;
  themeMode: ThemeMode;
  preferredRateType: RateType;
  setDeepseekKey: (key: string) => void;
  setManualRate: (rate: number | null) => void;
  setManualRateType: (type: RateType) => void;
  setUseDarkMode: (use: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setPreferredRateType: (type: RateType) => void;
  /** Carga la API Key desde SecureStore al iniciar */
  loadDeepseekKey: () => Promise<void>;
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
      setDeepseekKey: async (key: string) => {
        // Guardar en SecureStore (cifrado) si está disponible
        if (SecureStoreModule) {
          try {
            await SecureStoreModule.setItemAsync(SECURE_KEY_KEY, key);
          } catch {
            // Fallback silencioso a AsyncStorage
          }
        }
        set({ deepseekKey: key });
      },
      setManualRate: (rate) => set({ manualRate: rate }),
      setManualRateType: (type) => set({ manualRateType: type }),
      setUseDarkMode: (use) => set({ useDarkMode: use }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      setPreferredRateType: (type) => set({ preferredRateType: type }),
      loadDeepseekKey: async () => {
        if (SecureStoreModule) {
          try {
            const storedKey = await SecureStoreModule.getItemAsync(SECURE_KEY_KEY);
            if (storedKey) {
              set({ deepseekKey: storedKey });
              return;
            }
          } catch {
            // SecureStore falló, intentar fallback
          }
        }
        // Fallback: leer desde AsyncStorage (migración desde versión anterior)
        try {
          const raw = await AsyncStorage.getItem('finanzas-settings');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.state?.deepseekKey) {
              const key = parsed.state.deepseekKey;
              // Migrar a SecureStore si está disponible
              if (SecureStoreModule) {
                try {
                  await SecureStoreModule.setItemAsync(SECURE_KEY_KEY, key);
                } catch {
                  // Silencioso
                }
              }
              set({ deepseekKey: key });
              // Limpiar de AsyncStorage
              const state = { ...parsed.state, deepseekKey: '' };
              await AsyncStorage.setItem('finanzas-settings', JSON.stringify({ ...parsed, state }));
            }
          }
        } catch {
          // Silencioso - no hay key
        }
      },
    }),
    {
      name: 'finanzas-settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Excluir deepseekKey del persist en AsyncStorage (se guarda en SecureStore)
      partialize: (state) => {
        const { deepseekKey, ...rest } = state;
        return rest;
      },
    }
  )
);
