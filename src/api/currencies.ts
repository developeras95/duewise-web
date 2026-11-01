import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { components } from './schema';

export type Currency = components['schemas']['Currency'];

/** All currencies, or only the active ones. They rarely change, so they are cached for 10 minutes. */
export function useCurrencies(active?: boolean) {
  return useQuery({
    queryKey: ['currencies', active ?? 'all'],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/currencies', { params: { query: { active } } });
      return data!;
    },
    staleTime: 10 * 60_000,
  });
}

/** Decimal places per currency code, e.g. { INR: 2, JPY: 0 }, for formatting amounts. */
export function useMinorUnits() {
  const currencies = useCurrencies();
  const map = new Map<string, number>();
  for (const currency of currencies.data ?? []) {
    if (currency.code != null && currency.minorUnits != null) {
      map.set(currency.code, currency.minorUnits);
    }
  }
  return map;
}
