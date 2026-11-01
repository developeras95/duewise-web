import { describe, expect, it } from 'vitest';
import { decimalPlaces, invoiceTotals, lineAmounts, parseDecimal } from './money';

describe('money', () => {
  it('parses plain decimals only', () => {
    expect(parseDecimal('12.50')).toEqual({ units: 1250n, scale: 2 });
    expect(parseDecimal('.5')).toEqual({ units: 5n, scale: 1 });
    expect(parseDecimal(3)).toEqual({ units: 3n, scale: 0 });
    for (const bad of ['', '-1', '1e3', 'abc', '1.2.3', '.']) {
      expect(parseDecimal(bad)).toBeNull();
    }
  });

  it('counts decimal places without trailing zeros', () => {
    expect(decimalPlaces('1.500')).toBe(1);
    expect(decimalPlaces('1500.50')).toBe(1);
    expect(decimalPlaces('10')).toBe(0);
  });

  it('rounds each line half-up and taxes the rounded subtotal, as Duewise does', () => {
    // 1.5 hours × 333.33 = 499.995 → 500.00; 18% of 500.00 = 90.00
    expect(lineAmounts('1.5', '333.33', '18', 2)).toEqual({ subtotal: 500, tax: 90, total: 590 });
    // 18% of 0.10 = 0.018 → 0.02
    expect(lineAmounts('1', '0.10', '18', 2)).toEqual({ subtotal: 0.1, tax: 0.02, total: 0.12 });
    // No decimals for JPY: 3 × 333 = 999; 10% = 99.9 → 100
    expect(lineAmounts('3', '333', '10', 0)).toEqual({ subtotal: 999, tax: 100, total: 1099 });
  });

  it('is exact where floating point is not', () => {
    // In plain JavaScript, 0.1 * 3 is 0.30000000000000004.
    expect(lineAmounts('3', '0.1', '0', 2)).toEqual({ subtotal: 0.3, tax: 0, total: 0.3 });
    // 2.675 is stored as 2.67499999... as a float, so Math.round would give 2.67.
    expect(lineAmounts('1', '2.675', '0', 2)?.subtotal).toBe(2.68);
  });

  it('treats an empty tax rate as 0% and an unfinished quantity or price as no amount yet', () => {
    expect(lineAmounts('2', '50', '', 2)).toEqual({ subtotal: 100, tax: 0, total: 100 });
    expect(lineAmounts('', '50', '18', 2)).toBeNull();
    expect(lineAmounts('2', 'abc', '18', 2)).toBeNull();
  });

  it('adds up the rounded lines, skipping lines that are not valid yet', () => {
    const lines = [lineAmounts('1', '0.10', '18', 2), lineAmounts('1', '0.10', '18', 2), null];
    expect(invoiceTotals(lines, 2)).toEqual({ subtotal: 0.2, tax: 0.04, total: 0.24 });
  });
});
