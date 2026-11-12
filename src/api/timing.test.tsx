import { describe, expect, it } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { api } from './client';
import { clearTimings } from './timing';
import { RequestTimingBadge } from '../components/RequestTimingBadge';
import { formatDuration } from '../lib/format';
import { renderWithProviders } from '../test/render';
import { server } from '../test/server';

describe('request timing', () => {
  it('formats durations the way the badge shows them', () => {
    expect(formatDuration(0.561)).toBe('0.56 ms');
    expect(formatDuration(48.4)).toBe('48 ms');
    expect(formatDuration(1670)).toBe('1.67 s');
  });

  it('times every API call, failures included, and lists them newest first', async () => {
    clearTimings();
    server.use(http.get('*/api/v1/clients/9', () => HttpResponse.json({ title: 'Not found' }, { status: 404 })));
    renderWithProviders(<RequestTimingBadge />);
    expect(screen.getByRole('button', { name: 'No API requests yet' })).toBeInTheDocument();

    await act(() => api.GET('/api/v1/currencies'));
    await act(() => api.GET('/api/v1/clients/{id}', { params: { path: { id: 9 } } }).catch(() => undefined));

    await userEvent.click(screen.getByRole('button', { name: /Latest API request took/ }));
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('GET /api/v1/clients/9');
    expect(rows[0]).toHaveTextContent('404');
    expect(rows[1]).toHaveTextContent('GET /api/v1/currencies');
    expect(rows[1]).toHaveTextContent('200');
  });
});
