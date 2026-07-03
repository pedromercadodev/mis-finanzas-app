import { getDatabase } from './database';
import type { ExchangeRate, RateType } from '../utils/types';

export async function getLatestRate(): Promise<ExchangeRate | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<ExchangeRate>(
    'SELECT * FROM exchange_rates ORDER BY date DESC, id DESC LIMIT 1'
  );
}

export async function getLatestRateByType(type: RateType): Promise<ExchangeRate | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<ExchangeRate>(
    "SELECT * FROM exchange_rates WHERE rateType = ? AND source != '_SEEDED_' ORDER BY date DESC, id DESC LIMIT 1",
    [type]
  );
}

export async function saveRate(rate: Omit<ExchangeRate, 'id'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO exchange_rates (rateType, rateUSDToBS, date, source) VALUES (?, ?, ?, ?)',
    [rate.rateType, rate.rateUSDToBS, rate.date, rate.source]
  );
  return result.lastInsertRowId;
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
      // dolarapi.com puede devolver diferentes nombres de campo
      const nombre = (item.nombre || item.fuente || item.title || '').toLowerCase();
      const promedio = item.promedio || item.price || item.avg || null;
      
      if (nombre.includes('oficial') || nombre.includes('bcv')) {
        if (promedio) bcv = parseFloat(promedio);
      }
      if (nombre.includes('paralelo') || nombre.includes('paralel')) {
        if (promedio) parallel = parseFloat(promedio);
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
 * Obtiene la tasa desde el BCV directamente
 * Endpoint: GET https://www.bcv.org.ve/ (scraping simplificado)
 * Alternativa: API de terceros
 */
export async function fetchBCVFromDirectAPI(): Promise<number | null> {
  try {
    // Usamos una API alternativa que funciona en Venezuela
    const response = await fetch('https://pydolarve.org/api/v1/dollar?page=bcv');
    if (response.ok) {
      const data = await response.json();
      if (data?.price) {
        return parseFloat(data.price);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Obtiene la tasa desde el Paralelo (como respaldo para BCV)
 * Endpoint: GET https://exchange.api.com/api/v1/rates
 */
export async function fetchBCVFromMonitordolar(): Promise<number | null> {
  try {
    const response = await fetch('https://monitordolarvenezuela.com/api/v1/rates');
    if (response.ok) {
      const data = await response.json();
      if (data?.bcv) {
        return parseFloat(data.bcv);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Obtiene la tasa desde exchangerate.host como fallback adicional
 * Endpoint: GET https://api.exchangerate.host/latest?base=USD&symbols=VES
 */
export async function fetchBCVFromExchangeRateHost(): Promise<number | null> {
  try {
    const response = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=VES');
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
 * 2. pydolarve.org (fallback 1) - API alternativa
 * 3. exchangerate-api.com (fallback 2) - tasa oficial VES
 * 4. exchangerate.host (fallback 3) - API gratuita
 * 5. monitordolarvenezuela.com (fallback 4)
 */
export async function fetchBCVRate(): Promise<number | null> {
  // Intento 1: dolarapi.com
  const dolarApi = await fetchDolarApiRates();
  if (dolarApi.bcv) return dolarApi.bcv;

  // Intento 2: pydolarve.org
  const pydolarve = await fetchBCVFromDirectAPI();
  if (pydolarve) return pydolarve;

  // Intento 3: exchangerate-api.com
  const exchangeRate = await fetchBCVFromExchangeRateAPI();
  if (exchangeRate) return exchangeRate;

  // Intento 4: exchangerate.host
  const exchangeRateHost = await fetchBCVFromExchangeRateHost();
  if (exchangeRateHost) return exchangeRateHost;

  // Intento 5: monitordolarvenezuela.com
  const monitorDolar = await fetchBCVFromMonitordolar();
  if (monitorDolar) return monitorDolar;

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
