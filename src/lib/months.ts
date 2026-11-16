import dayjs from 'dayjs';

/** "2026-10": a month as Duewise writes it. */
export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The value if it is a month like "2026-10", otherwise undefined (e.g. a hand-edited address). */
export function validMonth(value: string | null | undefined) {
  return value && MONTH.test(value) ? value : undefined;
}

/** Every month from one to the other, both included: ["2026-09", "2026-10", "2026-11"]. */
export function monthRange(from: string, to: string) {
  const months: string[] = [];
  for (let month = dayjs(`${from}-01`); !month.isAfter(dayjs(`${to}-01`)); month = month.add(1, 'month')) {
    months.push(month.format('YYYY-MM'));
  }
  return months;
}

/** "October 2026", or "Oct 26" when short. */
export function monthLabel(month: string, short = false) {
  return dayjs(`${month}-01`).format(short ? 'MMM YY' : 'MMMM YYYY');
}
