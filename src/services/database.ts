import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from '../db/schema';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;
let initLock = false;

/**
 * Obtiene la instancia de la base de datos, inicializándola si es necesario.
 * 
 * Estrategia de inicialización:
 * 1. Primero intenta con openDatabaseAsync (API asíncrona estándar)
 * 2. Si falla (ej: NullPointerException con newArchEnabled), 
 *    intenta con openDatabaseSync (API síncrona, más estable)
 * 3. Si todo falla, elimina la BD y reintenta
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    if (initPromise) {
      await initPromise;
    }
    return db;
  }

  if (initLock) {
    while (initLock) {
      await new Promise(r => setTimeout(r, 50));
    }
    if (db) return db;
  }

  initLock = true;

  try {
    // Estrategia 1: Intentar con openDatabaseAsync
    try {
      db = await SQLite.openDatabaseAsync('finanzas.db');
    } catch (e) {
      console.warn('openDatabaseAsync falló, intentando con openDatabaseSync...', e);
      
      // Estrategia 2: Intentar con openDatabaseSync (más estable con newArchEnabled)
      try {
        db = SQLite.openDatabaseSync('finanzas.db');
      } catch (e2) {
        console.warn('openDatabaseSync también falló, eliminando y reintentando...', e2);
        
        // Estrategia 3: Eliminar BD corrupta y recrear
        try {
          await SQLite.deleteDatabaseAsync('finanzas.db');
        } catch {}
        
        // Reintentar con async primero
        try {
          db = await SQLite.openDatabaseAsync('finanzas.db');
        } catch {
          // Último recurso: sync
          db = SQLite.openDatabaseSync('finanzas.db');
        }
      }
    }

    if (!db) {
      throw new Error('No se pudo abrir la base de datos');
    }

    // Inicializar schema
    const database = db;
    if (!initPromise) {
      initPromise = initializeDatabase(database).catch(async (e) => {
        console.warn('Error inicializando BD, reintentando...', e);
        await new Promise(r => setTimeout(r, 1000));
        await initializeDatabase(database);
      });
    }
    await initPromise;

    return db;
  } catch (error) {
    db = null;
    initPromise = null;
    throw error;
  } finally {
    initLock = false;
  }
}

/**
 * Inicializa la base de datos de forma temprana (app startup).
 * Útil para llamar desde el layout principal y evitar race conditions.
 */
export async function ensureDatabaseInitialized(): Promise<void> {
  await getDatabase();
}
