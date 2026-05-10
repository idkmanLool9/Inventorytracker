import { v4 as uuid } from 'uuid';
import { upsertProduct } from './products';
import { upsertLocation } from './locations';

/**
 * Generate ~50 dummy products spread over a few categories.
 * Idempotent: re-running it upserts the same SKUs.
 *
 * Use it in-app via Settings (you can wire a button) or by importing
 * and calling `seedDummyData()` from `scripts/seed.ts`.
 */
const CATEGORIES = ['Drank', 'Snack', 'Brood', 'Zuivel', 'Schoonmaak', 'Cosmetica'];
const SUFFIX = ['Klein', 'Middel', 'Groot', 'Premium', 'Basis', 'Familieverpakking'];

function eanWithCheckDigit(base: string): string {
  const digits = base.padStart(12, '0').slice(0, 12).split('').map(Number);
  let sum = 0;
  for (let i = 11, mul = 3; i >= 0; i--, mul = mul === 3 ? 1 : 3) {
    sum += digits[i] * mul;
  }
  const check = (10 - (sum % 10)) % 10;
  return digits.join('') + check;
}

export async function seedDummyData(count = 50): Promise<{ products: number; locations: number }> {
  const locations = await Promise.all([
    upsertLocation({ name: 'Magazijn', aisle: 'A', shelf: '1' }),
    upsertLocation({ name: 'Winkelvloer voor', aisle: 'F', shelf: '1' }),
    upsertLocation({ name: 'Winkelvloer achter', aisle: 'B', shelf: '2' }),
  ]);

  let made = 0;
  for (let i = 1; i <= count; i++) {
    const cat = CATEGORIES[i % CATEGORIES.length];
    const suffix = SUFFIX[i % SUFFIX.length];
    const sku = `SKU-${String(i).padStart(4, '0')}`;
    const barcode = eanWithCheckDigit(String(8710000000000 + i));
    const cost = Math.round((1 + Math.random() * 10) * 100) / 100;
    const sale = Math.round(cost * (1.3 + Math.random() * 0.5) * 100) / 100;
    const stock = Math.floor(Math.random() * 60);
    const minStock = 5 + Math.floor(Math.random() * 10);

    await upsertProduct({
      id: uuid(),
      name: `${cat} ${suffix} #${i}`,
      sku,
      barcode,
      costPrice: cost,
      salePrice: sale,
      stock,
      minStock,
      locationId: locations[i % locations.length].id,
    });
    made++;
  }
  return { products: made, locations: locations.length };
}
