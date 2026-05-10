/**
 * Validate an EAN-13 or EAN-8 / UPC-A barcode using its check digit.
 * Returns true if the barcode is well-formed AND the check digit matches.
 */
export function isValidEAN(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  if (![8, 12, 13].includes(code.length)) return false;

  const digits = code.split('').map((c) => Number(c));
  const check = digits.pop()!;
  // GTIN check digit: sum of digits from right, alternating x3 and x1, then 10-(sum%10) mod 10.
  let sum = 0;
  for (let i = digits.length - 1, mul = 3; i >= 0; i--, mul = mul === 3 ? 1 : 3) {
    sum += digits[i] * mul;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === check;
}

export function detectBarcodeType(code: string): 'EAN-13' | 'EAN-8' | 'UPC-A' | 'unknown' {
  if (code.length === 13) return 'EAN-13';
  if (code.length === 12) return 'UPC-A';
  if (code.length === 8) return 'EAN-8';
  return 'unknown';
}

/**
 * Normalize a scanned barcode by trimming whitespace and stripping non-digits.
 * Useful when scanners append CR/LF or prefixes.
 */
export function normalizeBarcode(raw: string): string {
  return raw.trim().replace(/[^\d]/g, '');
}
