import { db, initializeDefaultData } from '../db/dexie-db';

let initialized = false;

export async function getDatabase(): Promise<typeof db> {
  if (!initialized) {
    await initializeDefaultData();
    initialized = true;
  }
  return db;
}

export { db };
