/**
 * Exact money arithmetic for the invoice editor's live totals, with the same rules as Duewise's
 * InvoiceMath, so the preview matches what Duewise saves to the last paisa:
 *
 *  - each line is rounded half-up to the currency's decimal places;
 *  - tax is worked out on the rounded line subtotal, then rounded;
 *  - invoice totals are the sums of the rounded lines.
 *
 * JavaScript numbers are binary floating point (0.1 + 0.2 !== 0.3), so amounts are held as whole
 * numbers of the smallest unit (BigInt) and only turned back into numbers for display.
 */

/** A decimal as an integer and how many digits of it are after the point: 12.50 → { units: 1250n, scale: 2 }. */
interface Scaled {
  units: bigint;
  scale: number;
}

/** Parses "12.5", "0.125" or 12.5; anything that is not a plain non-negative decimal gives null. */
export function parseDecimal(value: string | number | null | undefined): Scaled | null {
  if (value == null) return null;
  const text = typeof value === 'number' ? (Number.isFinite(value) ? value.toString() : '') : value.trim();
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[1] === '' && !match[2])) return null;
  const fraction = match[2] ?? '';
  return { units: BigInt((match[1] || '0') + fraction), scale: fraction.length };
}

/** Number of digits after the point, ignoring trailing zeros: "1.500" → 1. */
export function decimalPlaces(value: string | number): number {
  const parsed = parseDecimal(value);
  if (!parsed) return 0;
  let { units, scale } = parsed;
  while (scale > 0 && units % 10n === 0n) {
    units /= 10n;
    scale -= 1;
  }
  return scale;
}

/** Rescales to `scale` digits after the point, rounding half-up (all amounts here are >= 0). */
function rescale(value: Scaled, scale: number): bigint {
  if (scale >= value.scale) {
    return value.units * 10n ** BigInt(scale - value.scale);
  }
  const divisor = 10n ** BigInt(value.scale - scale);
  const quotient = value.units / divisor;
  return value.units % divisor >= divisor / 2n ? quotient + 1n : quotient;
}

function toNumber(units: bigint, scale: number): number {
  return Number(units) / 10 ** scale;
}

export interface LineAmounts {
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * One line's amounts, or null while the quantity or price is not (yet) a valid number.
 * An empty tax rate counts as 0%, as in Duewise.
 */
export function lineAmounts(
  quantity: string | number,
  unitPrice: string | number,
  taxRate: string | number | null | undefined,
  minorUnits: number,
): LineAmounts | null {
  const q = parseDecimal(quantity);
  const p = parseDecimal(unitPrice);
  const r = taxRate === '' || taxRate == null ? { units: 0n, scale: 0 } : parseDecimal(taxRate);
  if (!q || !p || !r) return null;

  const subtotal = rescale({ units: q.units * p.units, scale: q.scale + p.scale }, minorUnits);
  // subtotal × rate / 100: the division by 100 is two more digits after the point.
  const tax = rescale({ units: subtotal * r.units, scale: minorUnits + r.scale + 2 }, minorUnits);
  return {
    subtotal: toNumber(subtotal, minorUnits),
    tax: toNumber(tax, minorUnits),
    total: toNumber(subtotal + tax, minorUnits),
  };
}

/** Invoice totals: the sums of the rounded lines. Lines that are not valid yet are skipped. */
export function invoiceTotals(lines: (LineAmounts | null)[], minorUnits: number): LineAmounts {
  let subtotal = 0n;
  let tax = 0n;
  for (const line of lines) {
    if (!line) continue;
    subtotal += rescale(parseDecimal(line.subtotal.toFixed(minorUnits))!, minorUnits);
    tax += rescale(parseDecimal(line.tax.toFixed(minorUnits))!, minorUnits);
  }
  return {
    subtotal: toNumber(subtotal, minorUnits),
    tax: toNumber(tax, minorUnits),
    total: toNumber(subtotal + tax, minorUnits),
  };
}
