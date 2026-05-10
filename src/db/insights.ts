import { all, first } from './index';

export interface DashboardSummary {
  totalProducts: number;
  totalStockValueCost: number;
  totalStockValueRetail: number;
  outOfStock: number;
  lowStock: number;
  deadStock: number;
}

export async function getDashboardSummary(deadStockDays = 90): Promise<DashboardSummary> {
  const totals = await first<any>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(stock * cost_price), 0) AS value_cost,
       COALESCE(SUM(stock * sale_price), 0) AS value_retail,
       SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) AS oos,
       SUM(CASE WHEN stock <= min_stock AND stock > 0 THEN 1 ELSE 0 END) AS low
     FROM products WHERE archived = 0`
  );

  const cutoff = new Date(Date.now() - deadStockDays * 24 * 60 * 60 * 1000).toISOString();
  const dead = await first<{ c: number }>(
    `SELECT COUNT(*) AS c FROM products
     WHERE archived = 0 AND stock > 0
       AND (last_movement_at IS NULL OR last_movement_at < ?)`,
    [cutoff]
  );

  return {
    totalProducts: totals?.total ?? 0,
    totalStockValueCost: totals?.value_cost ?? 0,
    totalStockValueRetail: totals?.value_retail ?? 0,
    outOfStock: totals?.oos ?? 0,
    lowStock: totals?.low ?? 0,
    deadStock: dead?.c ?? 0,
  };
}

export interface TopMover {
  productId: string;
  name: string;
  unitsSold: number;
}

export async function getTopMovers(days = 30, limit = 5): Promise<TopMover[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const rows = await all<any>(
    `SELECT p.id AS productId, p.name AS name, SUM(m.quantity) AS unitsSold
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     WHERE m.type = 'out_sale' AND m.created_at >= ?
     GROUP BY p.id
     ORDER BY unitsSold DESC
     LIMIT ?`,
    [cutoff, limit]
  );
  return rows.map((r) => ({ productId: r.productId, name: r.name, unitsSold: r.unitsSold }));
}

export interface DailyMovementBucket {
  date: string; // YYYY-MM-DD
  inUnits: number;
  outUnits: number;
}

export async function getDailyMovements(days = 7): Promise<DailyMovementBucket[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const rows = await all<any>(
    `SELECT
       substr(created_at, 1, 10) AS date,
       SUM(CASE WHEN type IN ('in','transfer_in') THEN quantity ELSE 0 END) AS in_qty,
       SUM(CASE WHEN type IN ('out_sale','out_loss','out_damage','transfer_out') THEN quantity ELSE 0 END) AS out_qty
     FROM stock_movements
     WHERE created_at >= ?
     GROUP BY date
     ORDER BY date ASC`,
    [cutoff]
  );
  return rows.map((r) => ({ date: r.date, inUnits: r.in_qty ?? 0, outUnits: r.out_qty ?? 0 }));
}

export async function getLowStockProducts(limit = 20) {
  return all<{ id: string; name: string; stock: number; min_stock: number }>(
    `SELECT id, name, stock, min_stock FROM products
     WHERE archived = 0 AND stock <= min_stock
     ORDER BY (stock - min_stock) ASC
     LIMIT ?`,
    [limit]
  );
}
