import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { aClient, problem, server } from '../../test/server';
import { renderWithProviders } from '../../test/render';
import { ClientsPage } from './ClientsPage';
import { ClientDetailPage } from './ClientDetailPage';
import { EditClientPage, NewClientPage } from './ClientFormPage';

function page(content: ReturnType<typeof aClient>[], totalElements = content.length) {
  return { content, page: 0, size: 20, totalElements, totalPages: Math.ceil(totalElements / 20) };
}

function renderRoutes(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/clients" element={<ClientsPage />} />
      <Route path="/clients/new" element={<NewClientPage />} />
      <Route path="/clients/:id" element={<ClientDetailPage />} />
      <Route path="/clients/:id/edit" element={<EditClientPage />} />
    </Routes>,
    { route },
  );
}

describe('client list', () => {
  it('shows the clients and their total', async () => {
    server.use(
      http.get('*/api/v1/clients', () =>
        HttpResponse.json(page([aClient(), aClient({ id: 2, name: 'Blue Fern LLP', email: 'hi@bluefern.in' })], 57)),
      ),
    );

    renderRoutes('/clients');

    expect(await screen.findByText('Acme Design Studio')).toBeInTheDocument();
    expect(screen.getByText('Blue Fern LLP')).toBeInTheDocument();
    expect(screen.getByText('57 clients')).toBeInTheDocument();
  });

  it('searches as you type, after a short pause, from the first page', async () => {
    const queries: (string | null)[] = [];
    server.use(
      http.get('*/api/v1/clients', ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        queries.push(q);
        return HttpResponse.json(page(q ? [aClient({ id: 9, name: 'Fern & Co' })] : [aClient()]));
      }),
    );

    renderRoutes('/clients?page=2');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search clients' }), 'fern');

    expect(await screen.findByText('Fern & Co')).toBeInTheDocument();
    expect(queries).toContain('fern');
    expect(queries.filter((q) => q !== null && q !== 'fern')).toEqual([]); // no request per keystroke
  });
});

describe('client form', () => {
  it('shows a taken email next to the email field', async () => {
    server.use(
      http.post('*/api/v1/clients', () =>
        problem(409, 'CLIENT_EMAIL_TAKEN', 'A client with email asha@acmedesign.in already exists.'),
      ),
    );

    renderRoutes('/clients/new');
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), 'Acme');
    await userEvent.type(screen.getByRole('textbox', { name: /^Email/ }), 'asha@acmedesign.in');
    await userEvent.click(screen.getByRole('button', { name: 'Add client' }));

    expect(await screen.findByText('A client with email asha@acmedesign.in already exists.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Email/ })).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows field errors from Duewise under the matching fields', async () => {
    server.use(
      http.post('*/api/v1/clients', () =>
        problem(400, 'VALIDATION_FAILED', 'One or more fields are invalid.', [
          { field: 'address.postalCode', message: 'size must be between 0 and 20' },
        ]),
      ),
    );

    renderRoutes('/clients/new');
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), 'Acme');
    await userEvent.type(screen.getByRole('textbox', { name: /^Email/ }), 'a@acme.in');
    await userEvent.click(screen.getByRole('button', { name: 'Add client' }));

    expect(await screen.findByText('size must be between 0 and 20')).toBeInTheDocument();
  });

  it('sends the version it loaded when saving an edit, and opens the client afterwards', async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      http.get('*/api/v1/clients/1', () => HttpResponse.json(aClient())),
      http.get('*/api/v1/clients/1/statement', () =>
        HttpResponse.json({ clientId: 1, clientName: 'Acme', asOf: '2026-11-01', balances: [], openInvoices: [] }),
      ),
      http.put('*/api/v1/clients/1', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(aClient({ ...sent, version: 4 }));
      }),
    );

    renderRoutes('/clients/1/edit');
    const name = await screen.findByRole('textbox', { name: /^Name/ });
    await userEvent.clear(name);
    await userEvent.type(name, 'Acme Studio');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(sent).toBeDefined());
    expect(sent).toMatchObject({ name: 'Acme Studio', version: 3, email: 'asha@acmedesign.in' });
    expect(await screen.findByText('Nothing is owed: this client has no open invoices.')).toBeInTheDocument();
  });

  it('explains when someone else changed the client first', async () => {
    server.use(
      http.get('*/api/v1/clients/1', () => HttpResponse.json(aClient())),
      http.put('*/api/v1/clients/1', () =>
        problem(409, 'CONCURRENT_MODIFICATION', 'The resource was changed by another request.'),
      ),
    );

    renderRoutes('/clients/1/edit');
    await userEvent.click(await screen.findByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/Someone else changed this client/)).toBeInTheDocument();
  });
});

describe('client page', () => {
  it('shows the statement: balance per currency split by age, and the open invoices', async () => {
    server.use(
      http.get('*/api/v1/clients/1', () => HttpResponse.json(aClient())),
      http.get('*/api/v1/clients/1/statement', () =>
        HttpResponse.json({
          clientId: 1,
          clientName: 'Acme Design Studio',
          asOf: '2026-11-01',
          balances: [
            {
              currencyCode: 'INR',
              openInvoices: 2,
              totalOutstanding: 15000,
              current: 5000,
              days1To30: 0,
              days31To60: 10000,
              days61To90: 0,
              over90: 0,
            },
          ],
          openInvoices: [
            {
              id: 7,
              invoiceNumber: 'INV-2026-00007',
              currencyCode: 'INR',
              issueDate: '2026-08-01',
              dueDate: '2026-08-31',
              daysOverdue: 62,
              agingBucket: 'DAYS_61_90',
              balanceDue: 10000,
            },
            {
              id: 8,
              invoiceNumber: 'INV-2026-00008',
              currencyCode: 'INR',
              issueDate: '2026-10-20',
              dueDate: '2026-11-19',
              daysOverdue: 0,
              agingBucket: 'CURRENT',
              balanceDue: 5000,
            },
          ],
        }),
      ),
    );

    renderRoutes('/clients/1');

    expect(await screen.findByRole('heading', { name: 'Acme Design Studio' })).toBeInTheDocument();
    expect(screen.getByText('Bengaluru, Karnataka 560001')).toBeInTheDocument();
    expect(await screen.findByText('INR · 2 open')).toBeInTheDocument();
    expect(screen.getByText('₹15,000.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'INV-2026-00007' })).toHaveAttribute('href', '/invoices/7');
    const grid = screen.getByRole('grid');
    expect(within(grid).getByText('61–90 days')).toBeInTheDocument();
    expect(within(grid).getByText('Not yet due')).toBeInTheDocument();
  });
});
