import { v4 as uuid } from 'uuid';
import { all, first, exec, transaction } from './index';
import { Product, ProductVariant, UUID } from '@/types';

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  cost_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  location_id: string | null;
  photo_uri: string | null;
  shopify_product_id: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
  last_movement_at: string | null;
};

function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    barcode: r.barcode,
    categoryId: r.category_id,
    costPrice: r.cost_price,
    salePrice: r.sale_price,
    stock: r.stock,
    minStock: r.min_stock,
    locationId: r.location_id,
    photoUri: r.photo_uri,
    shopifyProductId: r.shopify_product_id,
    archived: !!r.archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastMovementAt: r.last_movement_at,
  };
}

export async function listProducts(filter?: { search?: string; lowStock?: boolean }): Promise<Product[]> {
  const clauses = ['archived = 0'];
  const params: any[] = [];
  if (filter?.search) {
    clauses.push('(name LIKE ? OR sku LIKE ? OR barcode LIKE ?)');
    const q = `%${filter.search}%`;
    params.push(q, q, q);
  }
  if (filter?.lowStock) clauses.push('stock <= min_stock');
  const rows = await all<ProductRow>(
    `SELECT * FROM products WHERE ${clauses.join(' AND ')} ORDER BY name ASC`,
    params
  );
  return rows.map(rowToProduct);
}

export async function getProduct(id: UUID): Promise<Product | null> {
  const row = await first<ProductRow>('SELECT * FROM products WHERE id = ?', [id]);
  return row ? rowToProduct(row) : null;
}

export async function findByBarcode(barcode: string): Promise<Product | null> {
  const row = await first<ProductRow>('SELECT * FROM products WHERE barcode = ? AND archived = 0', [
    barcode,
  ]);
  return row ? rowToProduct(row) : null;
}

export async function findBySku(sku: string): Promise<Product | null> {
  const row = await first<ProductRow>('SELECT * FROM products WHERE sku = ?', [sku]);
  return row ? rowToProduct(row) : null;
}

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'lastMovementAt'> & {
  id?: UUID;
  archived?: boolean;
};

export async function upsertProduct(input: ProductInput): Promise<Product> {
  const now = new Date().toISOString();
  const id = input.id ?? uuid();
  const existing = input.id ? await getProduct(input.id) : null;

  if (existing) {
    await exec(
      `UPDATE products SET
         name = ?, sku = ?, barcode = ?, category_id = ?,
         cost_price = ?, sale_price = ?, min_stock = ?, location_id = ?,
         photo_uri = ?, shopify_product_id = ?, archived = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.name,
        input.sku,
        input.barcode ?? null,
        input.categoryId ?? null,
        input.costPrice,
        input.salePrice,
        input.minStock,
        input.locationId ?? null,
        input.photoUri ?? null,
        input.shopifyProductId ?? null,
        input.archived ? 1 : 0,
        now,
        id,
      ]
    );
  } else {
    await exec(
      `INSERT INTO products (
         id, name, sku, barcode, category_id, cost_price, sale_price,
         stock, min_stock, location_id, photo_uri, shopify_product_id,
         archived, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.sku,
        input.barcode ?? null,
        input.categoryId ?? null,
        input.costPrice,
        input.salePrice,
        input.stock ?? 0,
        input.minStock,
        input.locationId ?? null,
        input.photoUri ?? null,
        input.shopifyProductId ?? null,
        input.archived ? 1 : 0,
        now,
        now,
      ]
    );
  }
  const saved = await getProduct(id);
  if (!saved) throw new Error('Product opslaan mislukt');
  return saved;
}

export async function archiveProduct(id: UUID): Promise<void> {
  await exec('UPDATE products SET archived = 1, updated_at = ? WHERE id = ?', [
    new Date().toISOString(),
    id,
  ]);
}

export async function listVariants(productId: UUID): Promise<ProductVariant[]> {
  const rows = await all<any>('SELECT * FROM product_variants WHERE product_id = ?', [productId]);
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    sku: r.sku,
    barcode: r.barcode,
    optionName: r.option_name,
    optionValue: r.option_value,
    stock: r.stock,
    costPrice: r.cost_price,
    salePrice: r.sale_price,
    shopifyVariantId: r.shopify_variant_id,
  }));
}

export async function upsertVariant(v: Omit<ProductVariant, 'id'> & { id?: UUID }): Promise<ProductVariant> {
  const id = v.id ?? uuid();
  const existing = v.id ? await first('SELECT id FROM product_variants WHERE id = ?', [v.id]) : null;
  if (existing) {
    await exec(
      `UPDATE product_variants SET sku=?, barcode=?, option_name=?, option_value=?,
        stock=?, cost_price=?, sale_price=?, shopify_variant_id=? WHERE id=?`,
      [
        v.sku,
        v.barcode ?? null,
        v.optionName,
        v.optionValue,
        v.stock,
        v.costPrice ?? null,
        v.salePrice ?? null,
        v.shopifyVariantId ?? null,
        id,
      ]
    );
  } else {
    await exec(
      `INSERT INTO product_variants
         (id, product_id, sku, barcode, option_name, option_value, stock, cost_price, sale_price, shopify_variant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        v.productId,
        v.sku,
        v.barcode ?? null,
        v.optionName,
        v.optionValue,
        v.stock,
        v.costPrice ?? null,
        v.salePrice ?? null,
        v.shopifyVariantId ?? null,
      ]
    );
  }
  return { ...v, id };
}

export async function bulkInsertProducts(items: ProductInput[]): Promise<number> {
  let count = 0;
  await transaction(async () => {
    for (const item of items) {
      await upsertProduct(item);
      count++;
    }
  });
  return count;
}
