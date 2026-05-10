import { all, exec, first } from './index';
import { ShopifyLocationMapping } from '@/types';

export async function listShopifyLocations(): Promise<ShopifyLocationMapping[]> {
  const rows = await all<any>('SELECT * FROM shopify_locations ORDER BY name');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    localLocationId: r.local_location_id,
    isDefault: !!r.is_default,
  }));
}

export async function getDefaultShopifyLocation(): Promise<ShopifyLocationMapping | null> {
  const r = await first<any>('SELECT * FROM shopify_locations WHERE is_default = 1 LIMIT 1');
  if (!r) {
    // Fallback: first known location, if any
    const any = await first<any>('SELECT * FROM shopify_locations LIMIT 1');
    return any
      ? { id: any.id, name: any.name, localLocationId: any.local_location_id, isDefault: false }
      : null;
  }
  return { id: r.id, name: r.name, localLocationId: r.local_location_id, isDefault: true };
}

export async function upsertShopifyLocation(
  loc: ShopifyLocationMapping
): Promise<void> {
  await exec(
    `INSERT INTO shopify_locations (id, name, local_location_id, is_default)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       local_location_id = excluded.local_location_id,
       is_default = excluded.is_default`,
    [loc.id, loc.name, loc.localLocationId ?? null, loc.isDefault ? 1 : 0]
  );
}

export async function setDefaultShopifyLocation(id: string): Promise<void> {
  await exec('UPDATE shopify_locations SET is_default = 0', []);
  await exec('UPDATE shopify_locations SET is_default = 1 WHERE id = ?', [id]);
}

export async function setLocalMapping(
  shopifyLocationId: string,
  localLocationId: string | null
): Promise<void> {
  await exec(
    'UPDATE shopify_locations SET local_location_id = ? WHERE id = ?',
    [localLocationId, shopifyLocationId]
  );
}
