/**
 * Tests the sync engine's queue/retry/conflict-resolution logic by mocking
 * the DB, the Shopify client, and the Shopify-locations helper. We don't
 * touch a real SQLite database here.
 */

jest.mock('../src/db', () => {
  const rows: Record<string, any[]> = { sync_queue: [] };
  const calls: any[] = [];
  return {
    __rows: rows,
    __calls: calls,
    getDb: jest.fn(),
    exec: jest.fn(async (sql: string, params: any[] = []) => {
      calls.push({ sql, params });
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
      if (
        sql.includes('UPDATE sync_queue SET status = ?, attempts = attempts + 1')
      ) {
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
    first: jest.fn(async () => null),
    all: jest.fn(async (sql: string) => {
      if (sql.includes('FROM sync_queue')) return rows.sync_queue;
      return [];
    }),
    transaction: jest.fn(async (fn: any) => fn({})),
  };
});

jest.mock('../src/db/products', () => ({
  upsertProduct: jest.fn(async (p: any) => ({ ...p, id: p.id ?? 'new-id' })),
  upsertVariant: jest.fn(async (v: any) => v),
  listVariants: jest.fn(async () => []),
  getProduct: jest.fn(async (id: string) => {
    if (id === 'p-with-shopify') {
      return {
        id: 'p-with-shopify',
        name: 'A',
        sku: 'A',
        stock: 7,
        minStock: 0,
        costPrice: 0,
        salePrice: 1,
        shopifyInventoryItemId: 'inv-1',
        archived: false,
        createdAt: 't',
        updatedAt: 't',
      };
    }
    return null;
  }),
}));

jest.mock('../src/db/shopifyLocations', () => ({
  getDefaultShopifyLocation: jest.fn(async () => ({
    id: 'loc-1',
    name: 'Main',
    localLocationId: null,
    isDefault: true,
  })),
  listShopifyLocations: jest.fn(async () => []),
  upsertShopifyLocation: jest.fn(async () => undefined),
}));

const mockSetInventoryLevel = jest.fn(async () => 7);
jest.mock('../src/services/shopify/client', () => ({
  ShopifyClient: jest.fn().mockImplementation(() => ({
    listProducts: jest.fn(async () => []),
    listLocations: jest.fn(async () => []),
    setInventoryLevel: mockSetInventoryLevel,
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    getProduct: jest.fn(),
    listInventoryLevels: jest.fn(),
  })),
}));

import {
  enqueue,
  listQueue,
  processQueue,
  applyRemoteProduct,
} from '../src/services/shopify/syncEngine';
import { ShopifyConfig } from '../src/types';

const cfg: ShopifyConfig = {
  enabled: true,
  domain: 'x.myshopify.com',
  accessToken: 't',
  apiVersion: '2024-04',
};

describe('sync engine', () => {
  beforeEach(() => {
    const dbMock = jest.requireMock('../src/db') as any;
    dbMock.__rows.sync_queue = [];
    dbMock.__calls.length = 0;
    mockSetInventoryLevel.mockClear();
  });

  it('enqueues a stock push job as pending', async () => {
    await enqueue('push_stock', { productId: 'p1', newStock: 5 });
    const q = await listQueue();
    expect(q).toHaveLength(1);
    expect(q[0].status).toBe('pending');
  });

  it('marks a job done after a successful push_stock', async () => {
    const dbMock = jest.requireMock('../src/db') as any;
    dbMock.__rows.sync_queue.push({
      id: 'job-success',
      operation: 'push_stock',
      payload: JSON.stringify({ productId: 'p-with-shopify' }),
      status: 'pending',
      attempts: 0,
      created_at: 't',
      updated_at: 't',
    });
    await processQueue(cfg);
    expect(mockSetInventoryLevel).toHaveBeenCalledWith('inv-1', 'loc-1', 7);
    expect(dbMock.__rows.sync_queue[0].status).toBe('done');
  });

  it('marks jobs failed after exceeding max attempts', async () => {
    const dbMock = jest.requireMock('../src/db') as any;
    dbMock.__rows.sync_queue.push({
      id: 'j1',
      operation: 'push_stock',
      payload: JSON.stringify({ productId: 'missing' }),
      status: 'pending',
      attempts: 4,
      created_at: 't',
      updated_at: 't',
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
    expect(productsMock.upsertProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        shopifyProductId: 'shopify-1',
        shopifyInventoryItemId: 'i1',
      })
    );
  });

  it('syncs additional variants with inventory_item_id', async () => {
    await applyRemoteProduct({
      id: 'shopify-2',
      title: 'Multi',
      handle: 'm',
      variants: [
        { id: 'v1', sku: 'A', price: '1', inventory_quantity: 1, inventory_item_id: 'i1' },
        { id: 'v2', sku: 'B', price: '2', inventory_quantity: 2, inventory_item_id: 'i2', option1: 'L' },
      ],
    });
    const productsMock = jest.requireMock('../src/db/products') as any;
    expect(productsMock.upsertVariant).toHaveBeenCalledWith(
      expect.objectContaining({ shopifyVariantId: 'v2', shopifyInventoryItemId: 'i2' })
    );
  });
});
