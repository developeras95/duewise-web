import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { App } from './App';
import { renderWithProviders } from './test/render';

describe('App', () => {
  it('shows the navigation and the dashboard with the API status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'UP', components: { db: { status: 'UP' }, mail: { status: 'UP' } } }), {
        status: 200,
      }),
    );

    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    for (const item of ['Invoices', 'Clients', 'Reminders', 'Settings']) {
      expect(screen.getAllByRole('link', { name: item }).length).toBeGreaterThan(0);
    }
    expect(await screen.findByText('Database')).toBeInTheDocument();
    expect(screen.getAllByText('UP')).toHaveLength(3);
  });

  it('says when the API cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    renderWithProviders(<App />);

    expect(await screen.findByText('Cannot reach Duewise')).toBeInTheDocument();
  });

  it('shows a not-found page for an unknown address', () => {
    renderWithProviders(<App />, { route: '/no-such-page' });

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
