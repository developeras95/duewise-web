import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { components } from './schema';

export type RevenueReport = components['schemas']['RevenueReport'];
export type RevenueMonth = components['schemas']['RevenueMonth'];
export type RevenueTotal = components['schemas']['RevenueTotal'];

const keys = {
  all: ['reports', 'revenue'] as const,
  revenue: (from?: string, to?: string) => ['reports', 'revenue', from ?? '', to ?? ''] as const,
};

/**
 * Money received per month and currency, from and to a month ("2026-10"), both included. Without them,
 * Duewise reports the last twelve months.
 */
export function useRevenueReport(from?: string, to?: string) {
  return useQuery({
    queryKey: keys.revenue(from, to),
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/reports/revenue', { params: { query: { from, to } } });
      return data!;
    },
    placeholderData: keepPreviousData,
  });
}

/** Recomputes the stored months now, as Duewise's nightly job does. */
export function useRefreshRevenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.POST('/api/v1/reports/revenue/refresh');
      return data!;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}
