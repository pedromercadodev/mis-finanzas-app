import { db } from '../db/dexie-db';
import type { ExchangeRate, RateType } from '../utils/types';

export async function getLatestRate(): Promise<ExchangeRate | null> {
  const rates = await db.exchangeRates
    .orderBy('id')
    .reverse()
    .limit(1)
    .toArray();
  return rates[0] || null;
}

export async function getLatestRateByType(type: RateType): Promise<ExchangeRate | null> {
  const rates = await db.exchangeRates
    .where('rateType')
    .equals(type)
    .reverse()
    .sortBy('id');
  return rates[0] || null;
}

export async function saveRate(rate: Omit<ExchangeRate, 'id'>): Promise<number> {
  const id = await db.exchangeRates.add(rate as ExchangeRate);
  return id as number;
}

// ─── DOLARAPI (Principal - ambas tasas) ────────────────────────────────────

/**
 * Obtiene ambas tasas (BCV y Paralelo) desde dolarapi.com
 * Endpoint: GET https://ve.dolarapi.com/v1/dolares
 * 
 * Respuesta:
 * - fuente "oficial" → promedio: tasa BCV
 * - fuente "paralelo" → promedio: tasa del dólar paralelo
 */
export async function fetchDolarApiRates(): Promise<{ bcv: number | null; parallel: number | null }> {
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares');
    const data = await response.json();
    
    if (!Array.isArray(data)) return { bcv: null, parallel: null };

    let bcv: number | null = null;
    let parallel: number | null = null;

    for (const item of data) {
      if (item.fuente === 'oficial' && item.promedio) {
        bcv = parseFloat(item.promedio);
      }
      if (item.fuente === 'paralelo' && item.promedio) {
        parallel = parseFloat(item.promedio);
      }
    }

    return { bcv, parallel };
  } catch {
    return { bcv: null, parallel: null };
  }
}

// ─── PARALLEL RATE (USDT / Dólar Paralelo) - Fallbacks ─────────────────────

/**
 * Obtiene la tasa USDT (Paralelo) desde Binance P2P
 * Endpoint: POST https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search
 */
export async function fetchBinanceRate(): Promise<number | null> {
  try {
    const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: 1,
        rows: 5,
        payTypes: [],
        countries: [],
        publisherType: 'merchant',
        asset: 'USDT',
        fiat: 'VES',
        tradeType: 'SELL',
      }),
    });

    const data = await response.json();
    if (data?.data?.length > 0) {
      // Tomamos el mejor precio (el más bajo para compra USDT)
      const prices = data.data.map((item: any) => parseFloat(item.adv.price));
      const bestPrice = Math.min(...prices);
      return bestPrice;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Obtiene la tasa desde Yadio.io como fallback
 * Endpoint: GET https://api.yadio.io/exrates/USD
 */
export async function fetchYadioRate(): Promise<number | null> {
  try {
    const response = await fetch('https://api.yadio.io/exrates/USD');
    const data = await response.json();
    if (data?.USD?.VES) {
      return parseFloat(data.USD.VES);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Obtiene la tasa USDT Paralelo con sistema de fallback:
 * 1. dolarapi.com (principal) - tasa del mercado paralelo venezolano
 * 2. Binance P2P (fallback 1) - mejor precio del mercado P2P
 * 3. Yadio.io (fallback 2) - tasa del mercado paralelo
 */
export async function fetchParallelRate(): Promise<number | null> {
  // Intento 1: dolarapi.com
  const dolarApi = await fetchDolarApiRates();
  if (dolarApi.parallel) return dolarApi.parallel;

  // Intento 2: Binance P2P
  const binanceRate = await fetchBinanceRate();
  if (binanceRate) return binanceRate;

  // Intento 3: Yadio.io
  const yadioRate = await fetchYadioRate();
  if (yadioRate) return yadioRate;

  return null;
}

// ─── BCV RATE (Dólar Oficial) - Fallbacks ──────────────────────────────────

/**
 * Obtiene la tasa BCV desde exchangerate-api.com como fallback
 * Endpoint: GET https://api.exchangerate-api.com/v4/latest/USD
 */
export async function fetchBCVFromExchangeRateAPI(): Promise<number | null> {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    if (data?.rates?.VES) {
      return parseFloat(data.rates.VES);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Obtiene la tasa BCV con sistema de fallback:
 * 1. dolarapi.com (principal) - fuente oficial BCV
 * 2. exchangerate-api.com (fallback) - tasa oficial VES
 */
export async function fetchBCVRate(): Promise<number | null> {
  // Intento 1: dolarapi.com
  const dolarApi = await fetchDolarApiRates();
  if (dolarApi.bcv) return dolarApi.bcv;

  // Intento 2: exchangerate-api.com
  const exchangeRate = await fetchBCVFromExchangeRateAPI();
  if (exchangeRate) return exchangeRate;

  return null;
}

// ─── UPDATE ALL RATES ──────────────────────────────────────────────────────

/**
 * Actualiza ambas tasas (BCV y Paralelo) y las guarda en la BD.
 * Usa dolarapi.com como fuente principal para ambas.
 * Devuelve los valores obtenidos (null si no se pudo obtener).
 */
export async function updateExchangeRates(): Promise<{ parallel: number | null; bcv: number | null }> {
  const today = new Date().toISOString().split('T')[0];

  // Intentar obtener ambas tasas de dolarapi.com primero
  const dolarApi = await fetchDolarApiRates();

  // Si dolarapi nos dio ambas, las guardamos juntas
  if (dolarApi.bcv && dolarApi.parallel) {
    await saveRate({
      rateType: 'BCV',
      rateUSDToBS: dolarApi.bcv,
      date: today,
      source: 'dolarapi.com',
    });
    await saveRate({
      rateType: 'PARALLEL',
      rateUSDToBS: dolarApi.parallel,
      date: today,
      source: 'dolarapi.com',
    });
    return { bcv: dolarApi.bcv, parallel: dolarApi.parallel };
  }

  // Fallback: obtener cada tasa por separado
  const parallelRate = dolarApi.parallel || await fetchParallelRate();
  if (parallelRate) {
    await saveRate({
      rateType: 'PARALLEL',
      rateUSDToBS: parallelRate,
      date: today,
      source: parallelRate === dolarApi.parallel ? 'dolarapi.com' : 'Binance P2P',
    });
  }

  const bcvRate = dolarApi.bcv || await fetchBCVRate();
  if (bcvRate) {
    await saveRate({
      rateType: 'BCV',
      rateUSDToBS: bcvRate,
      date: today,
      source: bcvRate === dolarApi.bcv ? 'dolarapi.com' : 'exchangerate-api.com',
    });
  }

  return { parallel: parallelRate, bcv: bcvRate };
}
