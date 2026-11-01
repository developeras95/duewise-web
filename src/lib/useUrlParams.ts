import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Page state kept in the address (?status=SENT&page=2), so Back, refresh and shared links show the
 * same view. Setting a value to undefined or '' removes it from the address.
 */
export function useUrlParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const update = useCallback(
    (changes: Record<string, string | number | boolean | undefined>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === '' || value === false) next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { get: (key: string) => searchParams.get(key), update };
}
