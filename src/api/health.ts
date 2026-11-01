import { useQuery } from '@tanstack/react-query';
import { ApiError, toApiError } from './client';

/** Spring Boot's health report, as Duewise exposes it at /actuator/health (details on). */
export interface HealthReport {
  status: string;
  components?: Record<string, { status: string; details?: Record<string, unknown> }>;
}

async function fetchHealth(): Promise<HealthReport> {
  let response: Response;
  try {
    response = await fetch('/actuator/health', { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'The Duewise API is not reachable. Is it running?');
  }
  // A DOWN component answers 503 with the same report, which is still worth showing.
  if (response.ok || response.status === 503) {
    try {
      return (await response.json()) as HealthReport;
    } catch {
      // fall through: not a health report (e.g. a proxy error page)
    }
  }
  throw await toApiError(response);
}

/** Health of the API and what it depends on (database, mail server), refreshed every 30 s. */
export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: fetchHealth, refetchInterval: 30_000 });
}
