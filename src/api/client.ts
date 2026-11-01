import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

/**
 * One field that failed validation, as Duewise reports it in a problem detail's "errors" list.
 */
export interface FieldViolation {
  field: string;
  message: string;
}

/**
 * Every failed API call becomes an ApiError. Duewise answers errors with an RFC 7807 problem
 * detail: a machine-readable code (e.g. INVOICE_NOT_DRAFT), a sentence for people, and for
 * validation failures one entry per invalid field. When the server cannot be reached at all,
 * the code is NETWORK_ERROR.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldViolation[];

  constructor(status: number, code: string, message: string, fieldErrors: FieldViolation[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** The message for one form field, if the server rejected it. */
  messageFor(field: string): string | undefined {
    return this.fieldErrors.find((violation) => violation.field === field)?.message;
  }
}

interface ProblemDetail {
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errors?: FieldViolation[];
}

/** Turns an error response into an ApiError, whether or not the body is a problem detail. */
export async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetail = {};
  try {
    problem = (await response.clone().json()) as ProblemDetail;
  } catch {
    // Not JSON: e.g. a proxy's HTML error page when the API is down.
  }
  const message =
    problem.detail ??
    problem.title ??
    (response.status === 502 || response.status === 503 || response.status === 504
      ? 'The Duewise API is not reachable. Is it running?'
      : `Request failed (HTTP ${response.status}).`);
  return new ApiError(response.status, problem.code ?? `HTTP_${response.status}`, message, problem.errors ?? []);
}

const throwOnError: Middleware = {
  async onResponse({ response }) {
    if (!response.ok) {
      throw await toApiError(response);
    }
    return undefined;
  },
  onError({ error }) {
    if (error instanceof ApiError) {
      return error;
    }
    return new ApiError(0, 'NETWORK_ERROR', 'The Duewise API is not reachable. Is it running?');
  },
};

/**
 * The typed client for the Duewise API. Paths, parameters and bodies are checked against
 * schema.d.ts, which is generated from Duewise's OpenAPI spec (npm run generate:api).
 *
 * Requests go to the same origin as the page ("/api/..."): in development Vite forwards them
 * to the API, in Docker nginx does, so the browser never needs CORS.
 */
export const api = createClient<paths>({
  baseUrl: globalThis.location?.origin ?? '',
  // Look fetch up on every call rather than once at start-up, so anything that wraps it later
  // (request timing, or the mock API in tests) sees every request.
  fetch: (request) => globalThis.fetch(request),
});
api.use(throwOnError);
