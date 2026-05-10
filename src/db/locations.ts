import { v4 as uuid } from 'uuid';
import { all, exec, first } from './index';
import { Location, UUID } from '@/types';

export async function listLocations(): Promise<Location[]> {
  const rows = await all<any>('SELECT * FROM locations ORDER BY name');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    aisle: r.aisle,
    shelf: r.shelf,
    shopifyLocationId: r.shopify_location_id,
  }));
}

export async function getLocation(id: UUID): Promise<Location | null> {
  const r = await first<any>('SELECT * FROM locations WHERE id = ?', [id]);
  return r
    ? {
        id: r.id,
        name: r.name,
        aisle: r.aisle,
        shelf: r.shelf,
        shopifyLocationId: r.shopify_location_id,
      }
    : null;
}

export async function upsertLocation(l: Omit<Location, 'id'> & { id?: UUID }): Promise<Location> {
  const id = l.id ?? uuid();
  const existing = l.id ? await getLocation(l.id) : null;
  if (existing) {
    await exec(
      'UPDATE locations SET name=?, aisle=?, shelf=?, shopify_location_id=? WHERE id=?',
      [l.name, l.aisle ?? null, l.shelf ?? null, l.shopifyLocationId ?? null, id]
    );
  } else {
    await exec(
      'INSERT INTO locations (id, name, aisle, shelf, shopify_location_id) VALUES (?, ?, ?, ?, ?)',
      [id, l.name, l.aisle ?? null, l.shelf ?? null, l.shopifyLocationId ?? null]
    );
  }
  return { ...l, id };
}
