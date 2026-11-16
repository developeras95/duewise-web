import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import dayjs from 'dayjs';
import type { RevenueReport } from '../../api/reports';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/render';
import { RevenuePage } from './RevenuePage';

const report: RevenueReport = {
  from: '2026-09',
  to: '2026-11',
  months: [
    { month: '2026-09', currencyCode: 'INR', payments: 3, received: 150000 },
    { month: '2026-10', currencyCode: 'INR', payments: 2, received: 90000.5 },
    { month: '2026-10', currencyCode: 'USD', payments: 1, received: 1200 },
    { month: '2026-11', currencyCode: 'INR', payments: 1, received: 25000 },
  ],
  totals: [
    { currencyCode: 'INR', payments: 6, received: 265000.5 },
    { currencyCode: 'USD', payments: 1, received: 1200 },
  ],
  storedAsOf: '2026-11-16T20:30:00Z',
  liveMonth: '2026-11',
};

describe('revenue report', () => {
  it('shows each currency on its own, says what is live, and lists every month', async () => {
    const asked: (string | null)[] = [];
    server.use(
      http.get('*/api/v1/reports/revenue', ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('from'));
        return HttpResponse.json(report);
      }),
    );

    renderWithProviders(<RevenuePage />, { route: '/revenue' });

    expect(await screen.findByText('September 2026 to November 2026')).toBeInTheDocument();
    expect(screen.getByText('₹265,000.50')).toBeInTheDocument();
    expect(screen.getByText('6 payments')).toBeInTheDocument();
    expect(screen.getAllByText('$1,200.00')).toHaveLength(2); // the USD card and its month
    expect(screen.getByText(/Months before November 2026 are as of .*; November 2026 is live/)).toBeInTheDocument();

    const rows = within(screen.getByRole('table', { name: 'Revenue by month' })).getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'MonthINRUSD',
      'November 2026 (so far)₹25,000.00–',
      'October 2026₹90,000.50$1,200.00',
      'September 2026₹150,000.00–',
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'This year' }));
    await waitFor(() => expect(asked).toContain(`${dayjs().year()}-01`));
  });

  it('refreshes the stored months on request', async () => {
    let refreshed = false;
    server.use(
      http.get('*/api/v1/reports/revenue', () =>
        HttpResponse.json({ ...report, liveMonth: undefined, from: '2026-09', to: '2026-10' }),
      ),
      http.post('*/api/v1/reports/revenue/refresh', () => {
        refreshed = true;
        return HttpResponse.json({ refreshedAt: '2026-11-16T21:00:00Z', tookMs: 1330 });
      }),
    );

    renderWithProviders(<RevenuePage />, { route: '/revenue?from=2026-09&to=2026-10' });

    expect(await screen.findByText(/^As of .*refreshes finished months every night/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh now' }));

    expect(await screen.findByText('Finished months refreshed in 1,330 ms')).toBeInTheDocument();
    expect(refreshed).toBe(true);
  });

  it('says so when nothing was received', async () => {
    server.use(
      http.get('*/api/v1/reports/revenue', () =>
        HttpResponse.json({ ...report, months: [], totals: [], liveMonth: undefined }),
      ),
    );

    renderWithProviders(<RevenuePage />, { route: '/revenue' });

    expect(await screen.findByText('No payments were received in this period.')).toBeInTheDocument();
  });
});
