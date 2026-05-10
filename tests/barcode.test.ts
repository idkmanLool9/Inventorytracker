import { isValidEAN, detectBarcodeType, normalizeBarcode } from '../src/utils/barcode';

describe('barcode utils', () => {
  it('validates a real EAN-13 with check digit', () => {
    // 5012345678900 is a textbook valid EAN-13
    expect(isValidEAN('5012345678900')).toBe(true);
  });

  it('rejects an EAN-13 with bad check digit', () => {
    expect(isValidEAN('5012345678901')).toBe(false);
  });

  it('rejects non-digit input', () => {
    expect(isValidEAN('abc1234567890')).toBe(false);
  });

  it('detects barcode type by length', () => {
    expect(detectBarcodeType('5012345678900')).toBe('EAN-13');
    expect(detectBarcodeType('012345678905')).toBe('UPC-A');
    expect(detectBarcodeType('40170725')).toBe('EAN-8');
    expect(detectBarcodeType('xx')).toBe('unknown');
  });

  it('normalizes scanner noise', () => {
    expect(normalizeBarcode(' 5012345678900\r\n')).toBe('5012345678900');
    expect(normalizeBarcode('AB12-34')).toBe('1234');
  });
});
