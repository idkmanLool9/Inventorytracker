import { parseCSV, rowsToObjects, toCSV } from '../src/utils/csv';

describe('csv utils', () => {
  it('parses a simple CSV with quotes', () => {
    const text = `name,sku,price\n"Brood, wit",B001,1.99\nMelk,M001,1.20`;
    const rows = parseCSV(text);
    expect(rows.length).toBe(3);
    expect(rows[1][0]).toBe('Brood, wit');
  });

  it('converts rows to objects using header', () => {
    const rows = [['name', 'sku'], ['A', 'X1'], ['B', 'X2']];
    expect(rowsToObjects(rows)).toEqual([
      { name: 'A', sku: 'X1' },
      { name: 'B', sku: 'X2' },
    ]);
  });

  it('serializes back to CSV with quoting', () => {
    const out = toCSV([{ name: 'Brood, wit', sku: 'B001' }]);
    expect(out.split('\n')[1]).toBe('"Brood, wit",B001');
  });
});
