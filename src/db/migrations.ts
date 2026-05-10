import { getDb } from './index';

interface Migration {
  version: number;
  name: string;
  up: string;
}

// Add new migrations to the end of this list; never re-number or remove old ones.
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'init',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('owner','manager','employee')),
        pin_hash TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        aisle TEXT,
        shelf TEXT,
        shopify_location_id TEXT
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT NOT NULL UNIQUE,
        barcode TEXT,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        cost_price REAL NOT NULL DEFAULT 0,
        sale_price REAL NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        min_stock INTEGER NOT NULL DEFAULT 0,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        photo_uri TEXT,
        shopify_product_id TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_movement_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

      CREATE TABLE IF NOT EXISTS product_variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sku TEXT NOT NULL UNIQUE,
        barcode TEXT,
        option_name TEXT NOT NULL,
        option_value TEXT NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        cost_price REAL,
        sale_price REAL,
        shopify_variant_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
        type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        reason TEXT,
        supplier TEXT,
        batch_number TEXT,
        from_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        to_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        user_id TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
      CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at);

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);

      CREATE TABLE IF NOT EXISTS conflict_log (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        field TEXT NOT NULL,
        local_value TEXT,
        remote_value TEXT,
        resolution TEXT NOT NULL,
        resolved_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  // Future migrations go here, e.g.:
  // { version: 2, name: 'add-suppliers-table', up: `CREATE TABLE suppliers ...` },
];

async function getCurrentVersion(): Promise<number> {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT MAX(version) as version FROM schema_migrations'
  );
  return row?.version ?? 0;
}

export async function runMigrations(): Promise<void> {
  const db = await getDb();
  const current = await getCurrentVersion();
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await db.execAsync('BEGIN;');
    try {
      await db.execAsync(m.up);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [m.version, m.name, new Date().toISOString()]
      );
      await db.execAsync('COMMIT;');
    } catch (e) {
      await db.execAsync('ROLLBACK;');
      throw new Error(`Migratie ${m.version} (${m.name}) faalde: ${(e as Error).message}`);
    }
  }
}
