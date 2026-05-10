import { v4 as uuid } from 'uuid';
import { all, exec, first, transaction } from './index';
import { MovementType, StockMovement, UUID } from '@/types';

export interface CreateMovementInput {
  productId: UUID;
  variantId?: UUID | null;
  type: MovementType;
  quantity: number;
  reason?: string | null;
  supplier?: string | null;
  batchNumber?: string | null;
  fromLocationId?: UUID | null;
  toLocationId?: UUID | null;
  userId: UUID;
  note?: string | null;
}

/**
 * Apply a stock movement: updates products/variants stock atomically
 * and records the movement to the audit log.
 *
 * `quantity` is always positive; the type determines the sign of stock change.
 */
export async function applyMovement(input: CreateMovementInput): Promise<StockMovement> {
  if (input.quantity <= 0) {
    throw new Error('Aantal moet groter dan 0 zijn');
  }
  const delta = stockDelta(input.type, input.quantity);
  const id = uuid();
  const now = new Date().toISOString();

  await transaction(async () => {
    if (input.variantId) {
      const v = await first<{ stock: number }>('SELECT stock FROM product_variants WHERE id = ?', [
        input.variantId,
      ]);
      if (!v) throw new Error('Variant niet gevonden');
      const next = v.stock + delta;
      if (next < 0) throw new Error('Onvoldoende voorraad voor deze variant');
      await exec('UPDATE product_variants SET stock = ? WHERE id = ?', [next, input.variantId]);
    }
    const p = await first<{ stock: number }>('SELECT stock FROM products WHERE id = ?', [
      input.productId,
    ]);
    if (!p) throw new Error('Product niet gevonden');
    const nextStock = p.stock + delta;
    if (nextStock < 0) throw new Error('Onvoldoende voorraad');
    await exec(
      'UPDATE products SET stock = ?, last_movement_at = ?, updated_at = ? WHERE id = ?',
      [nextStock, now, now, input.productId]
    );

    await exec(
      `INSERT INTO stock_movements (
         id, product_id, variant_id, type, quantity, reason,
         supplier, batch_number, from_location_id, to_location_id,
         user_id, note, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.productId,
        input.variantId ?? null,
        input.type,
        input.quantity,
        input.reason ?? null,
        input.supplier ?? null,
        input.batchNumber ?? null,
        input.fromLocationId ?? null,
        input.toLocationId ?? null,
        input.userId,
        input.note ?? null,
        now,
      ]
    );
  });

  return {
    id,
    productId: input.productId,
    variantId: input.variantId ?? null,
    type: input.type,
    quantity: input.quantity,
    reason: input.reason ?? null,
    supplier: input.supplier ?? null,
    batchNumber: input.batchNumber ?? null,
    fromLocationId: input.fromLocationId ?? null,
    toLocationId: input.toLocationId ?? null,
    userId: input.userId,
    note: input.note ?? null,
    createdAt: now,
  };
}

/**
 * Compute the signed change a movement applies to stock.
 * Exported so it can be unit-tested without touching the database.
 */
export function stockDelta(type: MovementType, quantity: number): number {
  switch (type) {
    case 'in':
    case 'transfer_in':
      return quantity;
    case 'out_sale':
    case 'out_loss':
    case 'out_damage':
    case 'transfer_out':
      return -quantity;
    case 'count_adjust':
      // For counts, `quantity` is the signed adjustment (handle separately if needed).
      return quantity;
  }
}

export async function listMovements(productId?: UUID, limit = 100): Promise<StockMovement[]> {
  const rows = productId
    ? await all<any>(
        'SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT ?',
        [productId, limit]
      )
    : await all<any>('SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT ?', [limit]);

  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    variantId: r.variant_id,
    type: r.type as MovementType,
    quantity: r.quantity,
    reason: r.reason,
    supplier: r.supplier,
    batchNumber: r.batch_number,
    fromLocationId: r.from_location_id,
    toLocationId: r.to_location_id,
    userId: r.user_id,
    note: r.note,
    createdAt: r.created_at,
  }));
}

/**
 * Apply a physical stock count: compare actual vs system stock and record
 * the delta as a `count_adjust` movement.
 */
export async function applyStockCount(
  productId: UUID,
  actual: number,
  userId: UUID,
  note?: string
): Promise<StockMovement | null> {
  const p = await first<{ stock: number }>('SELECT stock FROM products WHERE id = ?', [productId]);
  if (!p) throw new Error('Product niet gevonden');
  const delta = actual - p.stock;
  if (delta === 0) return null;
  return applyMovement({
    productId,
    type: 'count_adjust',
    quantity: delta,
    userId,
    note: note ?? `Telling: systeem ${p.stock} → werkelijk ${actual}`,
  });
}
