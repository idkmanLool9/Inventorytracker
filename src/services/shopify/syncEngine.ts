import { v4 as uuid } from 'uuid';
import { all, exec, first, transaction } from '@/db';
import { ShopifyConfig, SyncQueueItem, SyncOperation } from '@/types';
import {
  ShopifyClient,
  ShopifyProductDTO,
  ShopifyVariantDTO,
} from './client';
import { getProduct, upsertProduct, upsertVariant, listVariants } from '@/db/products';
import {
  getDefaultShopifyLocation,
  listShopifyLocations,
  upsertShopifyLocation,
} from '@/db/shopifyLocations';

/**
 * Local-first Shopify sync engine (REST 2024-04).
 *
 *  - Writes go to SQLite first; an outbound job is enqueued in `sync_queue`.
 *  - `processQueue()` drains the queue, with attempt counting and a
 *    max-retry cap that flips a job to `failed` (visible in the UI).
 *  - Conflict resolution: last-write-wins, with overwritten fields logged
 *    to `conflict_log` so the user can audit them later.
 *
 * Functions are exported individually so unit tests can replace the
 * underlying DB and client with mocks.
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
 * Refresh the locally cached list of Shopify locations and seed defaults.
 * The first location returned is marked default if none is set yet.
 */
export async function syncLocations(cfg: ShopifyConfig): Promise<void> {
  const client = new ShopifyClient(cfg);
  const remote = await client.listLocations();
  const existing = await listShopifyLocations();
  const hasDefault = existing.some((l) => l.isDefault);
  for (let i = 0; i < remote.length; i++) {
    const r = remote[i];
    const prev = existing.find((l) => l.id === r.id);
    await upsertShopifyLocation({
      id: r.id,
      name: r.name,
      localLocationId: prev?.localLocationId ?? null,
      isDefault: prev?.isDefault ?? (!hasDefault && i === 0),
    });
  }
}

/**
 * Full sync: locations, then pull catalogue, then drain outbound queue.
 */
export async function runFullSync(cfg: ShopifyConfig): Promise<void> {
  await syncLocations(cfg);

  const client = new ShopifyClient(cfg);
  const remote = await client.listProducts(100);
  for (const p of remote) {
    await applyRemoteProduct(p);
  }

  await processQueue(cfg);
}

/**
 * Apply a single Shopify product locally. Last-write-wins on the top-level
 * fields; per-variant rows are upserted with their `inventory_item_id`
 * preserved so subsequent stock pushes know what to set.
 *
 * The `now` param is injected for deterministic tests.
 */
export async function applyRemoteProduct(
  remote: ShopifyProductDTO,
  now: string = new Date().toISOString()
): Promise<void> {
  const v0 = remote.variants[0];
  if (!v0) return;

  const existing = await first<any>(
    'SELECT * FROM products WHERE shopify_product_id = ?',
    [remote.id]
  );

  if (!existing) {
    const saved = await upsertProduct({
      name: remote.title,
      sku: v0.sku || `shopify-${v0.id}`,
      barcode: v0.barcode ?? null,
      costPrice: 0,
      salePrice: Number(v0.price),
      stock: v0.inventory_quantity,
      minStock: 0,
      shopifyProductId: remote.id,
      shopifyInventoryItemId: v0.inventory_item_id,
    });
    await syncVariants(saved.id, remote.variants);
    return;
  }

  const remoteTimestamp = remote.updated_at ?? now;
  const fieldDiffs: Array<{ field: string; local: string; remote: string }> = [];
  if (existing.name !== remote.title)
    fieldDiffs.push({ field: 'name', local: existing.name, remote: remote.title });
  if (existing.sale_price !== Number(v0.price))
    fieldDiffs.push({
      field: 'sale_price',
      local: String(existing.sale_price),
      remote: v0.price,
    });

  const localIsNewer = existing.updated_at > remoteTimestamp;
  const resolution = localIsNewer ? 'local_wins' : 'remote_wins';
  for (const d of fieldDiffs) {
    await exec(
      `INSERT INTO conflict_log (id, product_id, field, local_value, remote_value, resolution, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), existing.id, d.field, d.local, d.remote, resolution, remoteTimestamp]
    );
  }

  if (localIsNewer) {
    // Still attach the inventory item id so future pushes work.
    if (!existing.shopify_inventory_item_id) {
      await exec(
        'UPDATE products SET shopify_inventory_item_id = ?, updated_at = ? WHERE id = ?',
        [v0.inventory_item_id, now, existing.id]
      );
    }
    await syncVariants(existing.id, remote.variants);
    return;
  }

  await upsertProduct({
    id: existing.id,
    name: remote.title,
    sku: v0.sku || existing.sku,
    barcode: v0.barcode ?? null,
    categoryId: existing.category_id,
    costPrice: existing.cost_price,
    salePrice: Number(v0.price),
    stock: v0.inventory_quantity,
    minStock: existing.min_stock,
    locationId: existing.location_id,
    photoUri: existing.photo_uri,
    shopifyProductId: remote.id,
    shopifyInventoryItemId: v0.inventory_item_id,
  });
  await syncVariants(existing.id, remote.variants);
}

async function syncVariants(productId: string, remoteVariants: ShopifyVariantDTO[]) {
  if (remoteVariants.length <= 1) return; // single-variant products are represented top-level
  const existing = await listVariants(productId);
  for (const rv of remoteVariants) {
    const local = existing.find((v) => v.shopifyVariantId === rv.id);
    await upsertVariant({
      id: local?.id,
      productId,
      sku: rv.sku || `shopify-${rv.id}`,
      barcode: rv.barcode ?? null,
      optionName: 'Variant',
      optionValue: rv.option1 ?? rv.option2 ?? rv.sku,
      stock: rv.inventory_quantity,
      costPrice: null,
      salePrice: Number(rv.price),
      shopifyVariantId: rv.id,
      shopifyInventoryItemId: rv.inventory_item_id,
    });
  }
}

/**
 * Drain the outbound queue. Each job that fails with a transient error
 * stays `pending` and the attempt counter increments. Once past
 * `MAX_ATTEMPTS`, the job is marked `failed` so it doesn't block others.
 */
export async function processQueue(cfg: ShopifyConfig): Promise<void> {
  const client = new ShopifyClient(cfg);
  const jobs = await all<any>(
    `SELECT * FROM sync_queue WHERE status IN ('pending','in_progress') ORDER BY created_at ASC`
  );
  for (const job of jobs) {
    await transaction(async () => {
      await exec(
        'UPDATE sync_queue SET status = ?, attempts = attempts + 1, updated_at = ? WHERE id = ?',
        ['in_progress', new Date().toISOString(), job.id]
      );
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
      if (!product) throw new Error('Product niet gevonden');
      if (!product.shopifyInventoryItemId) {
        throw new Error('Geen Shopify-inventory-item gekoppeld aan dit product');
      }
      const loc = await getDefaultShopifyLocation();
      if (!loc) throw new Error('Geen Shopify-locatie geconfigureerd');
      await client.setInventoryLevel(
        product.shopifyInventoryItemId,
        loc.id,
        product.stock
      );
      return;
    }
    case 'push_product': {
      const product = await getProduct(payload.productId);
      if (!product) throw new Error('Product niet gevonden');

      if (product.shopifyProductId) {
        const updated = await client.updateProduct({
          id: product.shopifyProductId,
          title: product.name,
          variants: [
            {
              sku: product.sku,
              barcode: product.barcode ?? null,
              price: String(product.salePrice),
            },
          ],
        });
        // Persist any new inventory_item_id we got back
        const v0 = updated.variants[0];
        if (v0 && v0.inventory_item_id !== product.shopifyInventoryItemId) {
          await upsertProduct({
            ...product,
            shopifyInventoryItemId: v0.inventory_item_id,
          });
        }
        return;
      }

      const created = await client.createProduct({
        title: product.name,
        status: 'active',
        variants: [
          {
            sku: product.sku,
            barcode: product.barcode ?? null,
            price: String(product.salePrice),
          },
        ],
      });
      const v0 = created.variants[0];
      await upsertProduct({
        ...product,
        shopifyProductId: created.id,
        shopifyInventoryItemId: v0?.inventory_item_id ?? null,
      });
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
