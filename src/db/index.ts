import * as SQLite from 'expo-sqlite';

const DB_NAME = 'inventorytracker.db';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  // expo-sqlite v14 async API
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  return _db;
}

export async function exec(sql: string, params: any[] = []) {
  const db = await getDb();
  return db.runAsync(sql, params);
}

export async function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  return db.getAllAsync<T>(sql, params);
}

export async function first<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const db = await getDb();
  return (await db.getFirstAsync<T>(sql, params)) ?? null;
}

export async function transaction<T>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const db = await getDb();
  await db.execAsync('BEGIN;');
  try {
    const result = await fn(db);
    await db.execAsync('COMMIT;');
    return result;
  } catch (e) {
    await db.execAsync('ROLLBACK;');
    throw e;
  }
}
