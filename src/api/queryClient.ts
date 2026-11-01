import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

/**
 * Shared cache for server data. Data is considered fresh for 30 seconds, so moving between
 * pages does not refetch everything; failed requests are retried once, except for client
 * errors (4xx), which would only fail again.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});
