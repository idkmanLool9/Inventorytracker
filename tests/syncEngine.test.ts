/**
 * Tests the sync engine's queue/retry/conflict-resolution logic by mocking
 * the DB and Shopify client modules. We don't touch a real SQLite database.
 */

jest.mock('../src/db', () => {
  const calls: any[] = [];
  const rows: Record<string, any[]> = { sync_queue: [], products: [], conflict_log: [] };
  return {
    __rows: rows,
    __calls: calls,
    getDb: jest.fn(),
    exec: jest.fn(async (sql: string, params: any[] = []) => {
      calls.push({ sql, params });
      // very tiny "INSERT INTO sync_queue ..." handler
      if (sql.includes('INSERT INTO sync_queue')) {
        rows.sync_queue.push({
          id: params[0],
          operation: params[1],
          payload: params[2],
          status: 'pending',
          attempts: 0,
          created_at: params[3],
          updated_at: params[4],
        });
      }
      if (sql.includes('UPDATE sync_queue SET status =') && sql.includes('attempts = attempts + 1')) {
        const id = params[2];
        const row = rows.sync_queue.find((r) => r.id === id);
        if (row) {
          row.status = params[0];
          row.attempts += 1;
        }
      }
      if (sql.startsWith('UPDATE sync_queue SET status = ?, updated_at')) {
        const id = params[2];
        const row = rows.sync_queue.find((r) => r.id === id);
        if (row) row.status = params[0];
      }
      if (sql.includes('UPDATE sync_queue SET status = ?, last_error')) {
        const id = params[3];
        const row = rows.sync_queue.find((r) => r.id === id);
        if (row) {
          row.status = params[0];
          row.last_error = params[1];
        }
      }
      if (sql.startsWith('DELETE FROM sync_queue WHERE status')) {
        rows.sync_queue = rows.sync_queue.filter((r) => r.status !== params[0]);
      }
      return undefined;
    }),
    first: jest.fn(async (sql: string, params: any[] = []) => {
      if (sql.includes('FROM products WHERE shopify_product_id')) return null;
      if (sql.includes('FROM products WHERE id')) return null;
      return null;
    }),
    all: jest.fn(async (sql: string) => {
      if (sql.includes('FROM sync_queue')) return rows.sync_queue;
      return [];
    }),
    transaction: jest.fn(async (fn: any) => fn({})),
  };
});

jest.mock('../src/db/products', () => ({
  upsertProduct: jest.fn(async (p: any) => ({ ...p, id: p.id ?? 'new-id' })),
  getProduct: jest.fn(async () => null),
}));

import { enqueue, listQueue, processQueue, applyRemoteProduct } from '../src/services/shopify/syncEngine';
import { ShopifyConfig } from '../src/types';

const cfg: ShopifyConfig = { enabled: true, domain: 'x.myshopify.com', accessToken: 't', apiVersion: '2024-04' };

describe('sync engine', () => {
  beforeEach(() => {
    // reset our in-memory mock rows
    const dbMock = jest.requireMock('../src/db') as any;
    dbMock.__rows.sync_queue = [];
    dbMock.__calls.length = 0;
  });

  it('enqueues a stock push job as pending', async () => {
    await enqueue('push_stock', { productId: 'p1', newStock: 5 });
    const q = await listQueue();
    expect(q).toHaveLength(1);
    expect(q[0].status).toBe('pending');
    expect(q[0].operation).toBe('push_stock');
  });

  it('marks jobs failed after exceeding max attempts', async () => {
    const dbMock = jest.requireMock('../src/db') as any;
    // Seed a queue entry already at attempts = 4 → next failure should mark failed.
    dbMock.__rows.sync_queue.push({
      id: 'j1',
      operation: 'push_stock',
      payload: JSON.stringify({ productId: 'missing' }),
      status: 'pending',
      attempts: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await processQueue(cfg);
    expect(dbMock.__rows.sync_queue[0].status).toBe('failed');
  });

  it('applies a remote product when none exists locally', async () => {
    await applyRemoteProduct({
      id: 'shopify-1',
      title: 'Test',
      handle: 't',
      variants: [
        {
          id: 'v1',
          sku: 'SKU-1',
          barcode: '',
          price: '9.99',
          inventory_quantity: 4,
          inventory_item_id: 'i1',
        },
      ],
    });
    const productsMock = jest.requireMock('../src/db/products') as any;
    expect(productsMock.upsertProduct).toHaveBeenCalled();
  });
});
