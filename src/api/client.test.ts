import { describe, expect, it } from 'vitest';
import { toApiError } from './client';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

describe('toApiError', () => {
  it('keeps the code, message and field errors of a Duewise problem detail', async () => {
    const error = await toApiError(
      jsonResponse(400, {
        title: 'Validation failed',
        status: 400,
        detail: 'One or more fields are invalid.',
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'email', message: 'must be a well-formed email address' }],
      }),
    );

    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.message).toBe('One or more fields are invalid.');
    expect(error.messageFor('email')).toBe('must be a well-formed email address');
    expect(error.messageFor('name')).toBeUndefined();
  });

  it('explains an unreachable API when the proxy answers 502 with a page that is not JSON', async () => {
    const error = await toApiError(new Response('<html>Bad Gateway</html>', { status: 502 }));

    expect(error.code).toBe('HTTP_502');
    expect(error.message).toBe('The Duewise API is not reachable. Is it running?');
  });

  it('falls back to the HTTP status for other errors without a body', async () => {
    const error = await toApiError(new Response(null, { status: 418 }));

    expect(error.message).toBe('Request failed (HTTP 418).');
  });
});
