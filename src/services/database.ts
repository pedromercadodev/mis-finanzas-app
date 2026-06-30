import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from '../db/schema';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('finanzas.db');
    await initializeDatabase(db);
  }
  return db;
}
