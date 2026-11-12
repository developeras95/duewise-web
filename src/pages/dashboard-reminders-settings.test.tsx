import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { problem, server } from '../test/server';
import { renderWithProviders } from '../test/render';
import { DashboardPage } from './DashboardPage';
import { RemindersPage } from './reminders/RemindersPage';
import { SettingsPage } from './settings/SettingsPage';

const settings = {
  ownerDigestEnabled: true,
  clientRemindersEnabled: true,
  recipients: [{ email: 'owner@duewise.local', type: 'TO' }],
  reminderDays: [7, 1, 14],
  updatedAt: '2026-11-01T09:00:00Z',
  version: 4,
};

describe('dashboard', () => {
  it('lists the oldest overdue invoices first, with how late they are', async () => {
    let query: URLSearchParams | undefined;
    server.use(
      http.get('*/api/v1/invoices', ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.get('overdue') !== 'true')
          return HttpResponse.json({ content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 });
        query = params;
        return HttpResponse.json({
          content: [
            {
              id: 3,
              invoiceNumber: 'INV-2026-00003',
              status: 'SENT',
              overdue: true,
              clientId: 1,
              clientName: 'Acme Design Studio',
              currencyCode: 'INR',
              issueDate: '2026-01-01',
              dueDate: '2026-01-31',
              total: 5000,
              balanceDue: 5000,
            },
          ],
          page: 0,
          size: 8,
          totalElements: 592044,
          totalPages: 74006,
        });
      }),
    );

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('INV-2026-00003 · Acme Design Studio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all 592,044' })).toHaveAttribute(
      'href',
      '/invoices?overdue=true&sort=dueDate&direction=asc',
    );
    expect(screen.getByText(/Due 31 Jan 2026 · \d+ days late/)).toBeInTheDocument();
    expect(query?.get('sort')).toBe('dueDate');
    expect(query?.get('direction')).toBe('asc');
    expect(await screen.findByText('No drafts waiting.')).toBeInTheDocument();
  });
});

describe('reminders', () => {
  it('shows the days in order and saves the whole settings with the version it read', async () => {
    let saved: Record<string, unknown> | undefined;
    server.use(
      http.get('*/api/v1/settings/reminders', () => HttpResponse.json(settings)),
      http.put('*/api/v1/settings/reminders', async ({ request }) => {
        saved = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...settings, ...saved, version: 5 });
      }),
    );

    renderWithProviders(<RemindersPage />);

    const chips = await screen.findAllByText(/^\d+ days?$/);
    expect(chips.map((chip) => chip.textContent)).toEqual(['1 day', '7 days', '14 days']);

    await userEvent.type(screen.getByRole('textbox', { name: 'Add a day' }), '7');
    expect(screen.getByText('Already in the list')).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('textbox', { name: 'Add a day' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Add a day' }), '30{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Add recipient' }));
    await userEvent.type(screen.getAllByRole('textbox', { name: 'Email' })[1], 'Owner@duewise.local');
    expect(screen.getByText('Listed twice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();

    await userEvent.clear(screen.getAllByRole('textbox', { name: 'Email' })[1]);
    await userEvent.type(screen.getAllByRole('textbox', { name: 'Email' })[1], 'accounts@duewise.local');
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(saved).toBeDefined());
    expect(saved).toEqual({
      clientRemindersEnabled: true,
      ownerDigestEnabled: true,
      reminderDays: [1, 7, 14, 30],
      recipients: [
        { email: 'owner@duewise.local', type: 'TO' },
        { email: 'accounts@duewise.local', type: 'TO' },
      ],
      version: 4,
    });
  });

  it('runs the reminders after asking, and says what happened', async () => {
    server.use(
      http.get('*/api/v1/settings/reminders', () => HttpResponse.json(settings)),
      http.post('*/api/v1/reminders/run', () =>
        HttpResponse.json({
          runDate: '2026-11-13',
          overdueInvoices: 12,
          clientRemindersSent: 3,
          clientRemindersFailed: 0,
          clientRemindersSkipped: 9,
          ownerDigest: 'ALREADY_SENT_TODAY',
        }),
      ),
    );

    renderWithProviders(<RemindersPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Run now' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Run now' }));

    expect(await screen.findByText(/looked at 12 overdue invoices; 3 client reminders sent/)).toBeInTheDocument();
    expect(screen.getByText(/already sent today/)).toBeInTheDocument();
  });
});

describe('settings', () => {
  it('adds a currency, and shows it when the code already exists', async () => {
    let body: unknown;
    server.use(
      http.post('*/api/v1/currencies', async ({ request }) => {
        body = await request.json();
        return problem(409, 'CURRENCY_ALREADY_EXISTS', 'Currency SGD already exists.');
      }),
    );

    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('Indian Rupee')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add currency' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Code/ }), 'sgd');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Name/ }), 'Singapore Dollar');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Symbol/ }), 'S$');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('Currency SGD already exists.')).toBeInTheDocument();
    expect(body).toEqual({ code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', minorUnits: 2 });
  });
});
