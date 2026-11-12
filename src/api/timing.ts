import { useSyncExternalStore } from 'react';

/** One finished call to the Duewise API, as the browser saw it (network + server + JSON). */
export interface RequestTiming {
  id: number;
  method: string;
  path: string;
  status: number;
  ms: number;
  at: number;
}

const MAX_ENTRIES = 30;
let entries: RequestTiming[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

/** Records a call; the newest is first. Keeps the last 30. */
export function recordTiming(timing: Omit<RequestTiming, 'id' | 'at'>) {
  entries = [{ ...timing, id: nextId++, at: Date.now() }, ...entries].slice(0, MAX_ENTRIES);
  listeners.forEach((listener) => listener());
}

export function clearTimings() {
  entries = [];
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The recent API calls, newest first; the component re-renders when one finishes. */
export function useRequestTimings() {
  return useSyncExternalStore(subscribe, () => entries);
}

/**
 * fetch, timed. Wraps every call the typed API client makes, so the timing badge shows what each
 * screen really costs: the browser's view, from sending the request to having the whole response.
 */
export async function timedFetch(request: Request): Promise<Response> {
  const started = performance.now();
  const url = new URL(request.url);
  try {
    const response = await globalThis.fetch(request);
    // Wait for the whole body, so a large response (e.g. a 36,000-row statement) is fully counted.
    await response.clone().arrayBuffer();
    recordTiming({
      method: request.method,
      path: url.pathname + url.search,
      status: response.status,
      ms: performance.now() - started,
    });
    return response;
  } catch (error) {
    recordTiming({
      method: request.method,
      path: url.pathname + url.search,
      status: 0,
      ms: performance.now() - started,
    });
    throw error;
  }
}
