import dayjs from 'dayjs';

const moneyFormats = new Map<string, (amount: number) => string>();

function moneyFormat(currencyCode: string | undefined, minorUnits: number | undefined) {
  const digits = { minimumFractionDigits: minorUnits, maximumFractionDigits: minorUnits };
  try {
    const format = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode ?? 'XXX', ...digits });
    return (amount: number) => format.format(amount);
  } catch {
    // Not an ISO 4217 code the browser knows: plain number followed by the code.
    const format = new Intl.NumberFormat(undefined, { ...digits, minimumFractionDigits: minorUnits ?? 2 });
    return (amount: number) => `${format.format(amount)} ${currencyCode ?? ''}`.trim();
  }
}

/**
 * "₹1,25,000.00", "$1,250.00": an amount in its own currency, with the currency's decimal places.
 * The number layout follows the user's browser language. Unknown codes become "1,250.00 XYZ".
 */
export function formatMoney(amount: number | null | undefined, currencyCode: string | undefined, minorUnits?: number) {
  if (amount == null) {
    return '';
  }
  const key = `${currencyCode}|${minorUnits ?? ''}`;
  let format = moneyFormats.get(key);
  if (!format) {
    format = moneyFormat(currencyCode, minorUnits);
    moneyFormats.set(key, format);
  }
  return format(amount);
}

/** "5 Nov 2026", the same style as Duewise's PDF invoices. */
export function formatDate(value: string | null | undefined) {
  return value ? dayjs(value).format('D MMM YYYY') : '';
}

/** "5 Nov 2026, 14:05" in the user's time zone. */
export function formatDateTime(value: string | null | undefined) {
  return value ? dayjs(value).format('D MMM YYYY, HH:mm') : '';
}

const countryNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

/** "IN" becomes "India"; anything not recognised is shown as it is. */
export function countryName(code: string | null | undefined) {
  if (!code) {
    return '';
  }
  try {
    return countryNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** Address lines as printed on an invoice: street lines, "City, State 560001", country. */
export function addressLines(address?: {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
}) {
  if (!address) {
    return [];
  }
  const place = [address.city, address.state].filter(Boolean).join(', ');
  const cityLine = [place, address.postalCode].filter(Boolean).join(' ');
  return [address.line1, address.line2, cityLine, countryName(address.countryCode)].filter((line): line is string =>
    Boolean(line && line.trim()),
  );
}
