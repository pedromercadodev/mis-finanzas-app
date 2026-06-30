import { useState, useEffect, useCallback, useRef } from 'react';
import { getLatestRateByType } from '../services/exchangeRate';
import { updateExchangeRates } from '../services/exchangeRate';
import type { ExchangeRate } from '../utils/types';

interface ExchangeRatesState {
  bcv: ExchangeRate | null;
  parallel: ExchangeRate | null;
  loading: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

/**
 * Hook personalizado para obtener y gestionar las tasas de cambio (BCV y Paralelo).
 * 
 * - Carga las últimas tasas desde la BD al montarse
 * - Provee función refresh() para actualizar desde las APIs
 * - Opcional: auto-refresh cada cierto intervalo
 */
export function useExchangeRates(autoRefreshInterval?: number) {
  const [state, setState] = useState<ExchangeRatesState>({
    bcv: null,
    parallel: null,
    loading: true,
    lastUpdated: null,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadFromDB = useCallback(async () => {
    try {
      const [bcvRate, parallelRate] = await Promise.all([
        getLatestRateByType('BCV'),
        getLatestRateByType('PARALLEL'),
      ]);
      setState(prev => ({
        ...prev,
        bcv: bcvRate,
        parallel: parallelRate,
        loading: false,
        error: null,
      }));
    } catch {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await updateExchangeRates();
      // Recargar desde la BD para tener los datos guardados
      const [bcvRate, parallelRate] = await Promise.all([
        getLatestRateByType('BCV'),
        getLatestRateByType('PARALLEL'),
      ]);
      setState({
        bcv: bcvRate,
        parallel: parallelRate,
        loading: false,
        lastUpdated: new Date(),
        error: (!result.bcv && !result.parallel) ? 'No se pudieron obtener las tasas' : null,
      });
    } catch (e) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Error al actualizar tasas',
      }));
    }
  }, []);

  // Cargar tasas al montar el componente
  useEffect(() => {
    loadFromDB();
  }, [loadFromDB]);

  // Auto-refresh opcional
  useEffect(() => {
    if (autoRefreshInterval && autoRefreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        refresh();
      }, autoRefreshInterval);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefreshInterval, refresh]);

  return {
    ...state,
    refresh,
    loadFromDB,
  };
}
