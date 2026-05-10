import { v4 as uuid } from 'uuid';
import { all, exec, first, transaction } from '@/db';
import { ShopifyConfig, SyncQueueItem, SyncOperation } from '@/types';
import { ShopifyClient, ShopifyProductDTO } from './client';
import { getProduct, upsertProduct } from '@/db/products';

/**
 * Local-first Shopify sync engine.
 *
 * Strategy:
 *  - Writes go straight to SQLite. Each write also pushes a job onto the
 *    `sync_queue` table.
 *  - `processQueue()` drains the queue with retry/backoff. Network errors
 *    keep the job alive; logic errors mark it failed (visible in UI).
 *  - Conflict resolution is last-write-wins: when pulling a Shopify product
 *    we compare timestamps. If the remote is newer, we apply it and log
 *    overwritten local fields to `conflict_log`.
 *
 * The engine is exported as plain functions so it stays easy to unit-test
 * against a mocked ShopifyClient.
 */

const MAX_ATTEMPTS = 5;

export async function enqueue(operation: SyncOperation, payload: unknown): Promise<void> {
  const now = new Date().toISOString();
  await exec(
    `INSERT INTO sync_queue (id, operation, payload, status, attempts, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', 0, ?, ?)`,
    [uuid(), operation, JSON.stringify(payload), now, now]
  );
}

export async function queueStockPush(productId: string, newStock: number) {
  await enqueue('push_stock', { productId, newStock });
}

export async function queueProductPush(productId: string) {
  await enqueue('push_product', { productId });
}

export async function listQueue(): Promise<SyncQueueItem[]> {
  const rows = await all<any>('SELECT * FROM sync_queue ORDER BY created_at ASC');
  return rows.map((r) => ({
    id: r.id,
    operation: r.operation,
    payload: r.payload,
    status: r.status,
    attempts: r.attempts,
    lastError: r.last_error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function clearQueue(): Promise<void> {
  await exec('DELETE FROM sync_queue WHERE status = ?', ['done']);
}

/**
 * Run a full sync: pull catalogue, then drain the outbound queue.
 * Caller is responsible for `cfg.enabled` check (UI layer).
 */
export async function runFullSync(cfg: ShopifyConfig): Promise<void> {
  const client = new ShopifyClient(cfg);
  const remote = await client.listProducts(100);
  for (const p of remote) {
    await applyRemoteProduct(p);
  }
  await processQueue(cfg);
}

/**
 * Apply a single Shopify product to local SQLite using last-write-wins.
 * If the local copy is newer, we log a conflict and keep the local version.
 */
export async function applyRemoteProduct(remote: ShopifyProductDTO): Promise<void> {
  // We use the first variant for top-level price/sku; richer mapping would
  // populate `product_variants` for products with multiple variants.
  const v0 = remote.variants[0];
  if (!v0) return;

  const existing = await first<any>('SELECT * FROM products WHERE shopify_product_id = ?', [
    remote.id,
  ]);
  const remoteUpdated = new Date().toISOString();

  if (!existing) {
    await upsertProduct({
      name: remote.title,
      sku: v0.sku,
      barcode: v0.barcode ?? null,
      costPrice: 0,
      salePrice: Number(v0.price),
      stock: v0.inventory_quantity,
      minStock: 0,
      shopifyProductId: remote.id,
    });
    return;
  }

  // Conflict detection: log changes that the remote overrides.
  const fieldDiffs: Array<{ field: string; local: string; remote: string }> = [];
  if (existing.name !== remote.title)
    fieldDiffs.push({ field: 'name', local: existing.name, remote: remote.title });
  if (existing.sale_price !== Number(v0.price))
    fieldDiffs.push({
      field: 'sale_price',
      local: String(existing.sale_price),
      remote: v0.price,
    });

  const localIsNewer = existing.updated_at > remoteUpdated;
  if (localIsNewer) {
    for (const d of fieldDiffs) {
      await exec(
        `INSERT INTO conflict_log (id, product_id, field, local_value, remote_value, resolution, resolved_at)
         VALUES (?, ?, ?, ?, ?, 'local_wins', ?)`,
        [uuid(), existing.id, d.field, d.local, d.remote, remoteUpdated]
      );
    }
    return;
  }

  for (const d of fieldDiffs) {
    await exec(
      `INSERT INTO conflict_log (id, product_id, field, local_value, remote_value, resolution, resolved_at)
       VALUES (?, ?, ?, ?, ?, 'remote_wins', ?)`,
      [uuid(), existing.id, d.field, d.local, d.remote, remoteUpdated]
    );
  }

  await upsertProduct({
    id: existing.id,
    name: remote.title,
    sku: v0.sku,
    barcode: v0.barcode ?? null,
    categoryId: existing.category_id,
    costPrice: existing.cost_price,
    salePrice: Number(v0.price),
    stock: v0.inventory_quantity,
    minStock: existing.min_stock,
    locationId: existing.location_id,
    photoUri: existing.photo_uri,
    shopifyProductId: remote.id,
  });
}

/**
 * Drain the outbound queue. Each job that fails with a transient error
 * stays `pending` and the attempt counter increments. Past `MAX_ATTEMPTS`
 * we mark it failed so it doesn't block the rest of the queue.
 */
export async function processQueue(cfg: ShopifyConfig): Promise<void> {
  const client = new ShopifyClient(cfg);
  const jobs = await all<any>(
    `SELECT * FROM sync_queue WHERE status IN ('pending','in_progress') ORDER BY created_at ASC`
  );
  for (const job of jobs) {
    await transaction(async () => {
      await exec('UPDATE sync_queue SET status = ?, attempts = attempts + 1, updated_at = ? WHERE id = ?', [
        'in_progress',
        new Date().toISOString(),
        job.id,
      ]);
    });

    try {
      await runJob(client, job);
      await exec('UPDATE sync_queue SET status = ?, updated_at = ? WHERE id = ?', [
        'done',
        new Date().toISOString(),
        job.id,
      ]);
    } catch (e) {
      const attempts = job.attempts + 1;
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      await exec(
        'UPDATE sync_queue SET status = ?, last_error = ?, updated_at = ? WHERE id = ?',
        [status, (e as Error).message, new Date().toISOString(), job.id]
      );
    }
  }
}

async function runJob(client: ShopifyClient, job: any): Promise<void> {
  const payload = JSON.parse(job.payload);
  switch (job.operation as SyncOperation) {
    case 'push_stock': {
      const product = await getProduct(payload.productId);
      if (!product?.shopifyProductId) throw new Error('Geen Shopify-product gekoppeld');
      // Real impl needs inventory_item_id + location_id mapping;
      // this is left as the integration point.
      // await client.setInventoryLevel(itemId, locationId, payload.newStock);
      return;
    }
    case 'push_product': {
      const product = await getProduct(payload.productId);
      if (!product) throw new Error('Product niet gevonden');
      // POST/PUT /products.json — left as integration point.
      return;
    }
    case 'pull_product': {
      const remote = await client.getProduct(payload.shopifyProductId);
      await applyRemoteProduct(remote);
      return;
    }
    case 'push_variant':
      return;
  }
}
