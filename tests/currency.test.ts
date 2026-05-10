import { formatEUR, parseEUR } from '../src/utils/currency';

describe('currency utils', () => {
  it('parses Dutch-style amounts', () => {
    expect(parseEUR('12,50')).toBeCloseTo(12.5);
    expect(parseEUR('1.234,56')).toBeCloseTo(1234.56);
    expect(parseEUR('12.50')).toBeCloseTo(12.5); // accept dot too
  });

  it('returns 0 for garbage', () => {
    expect(parseEUR('abc')).toBe(0);
  });

  it('formats numbers as euro', () => {
    expect(formatEUR(0)).toMatch(/0,00/);
  });
});
