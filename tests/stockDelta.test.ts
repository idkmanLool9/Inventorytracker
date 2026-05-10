import { stockDelta } from '../src/db/movements';

describe('stockDelta', () => {
  it('adds for incoming stock', () => {
    expect(stockDelta('in', 5)).toBe(5);
    expect(stockDelta('transfer_in', 3)).toBe(3);
  });

  it('subtracts for outgoing stock', () => {
    expect(stockDelta('out_sale', 4)).toBe(-4);
    expect(stockDelta('out_loss', 1)).toBe(-1);
    expect(stockDelta('out_damage', 2)).toBe(-2);
    expect(stockDelta('transfer_out', 6)).toBe(-6);
  });

  it('passes signed adjustment through for count_adjust', () => {
    expect(stockDelta('count_adjust', 7)).toBe(7);
    expect(stockDelta('count_adjust', -3)).toBe(-3);
  });
});
