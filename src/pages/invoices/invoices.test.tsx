import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import type { components } from '../../api/schema';
import { aClient, problem, server } from '../../test/server';
import { renderWithProviders } from '../../test/render';
import { invoiceFormSchema, emptyInvoiceForm, toFormPath, toRequest } from './invoiceForm';
import { InvoicesPage } from './InvoicesPage';
import { InvoiceDetailPage } from './InvoiceDetailPage';
import { NewInvoicePage } from './InvoiceFormPage';

type Invoice = components['schemas']['Invoice'];

function anInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 17,
    invoiceNumber: undefined,
    status: 'DRAFT',
    overdue: false,
    client: { id: 1, name: 'Acme Design Studio' },
    currencyCode: 'INR',
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    lines: [
      {
        lineNo: 1,
        description: 'Logo design',
        quantity: 1,
        unitPrice: 10000,
        taxRate: 18,
        lineSubtotal: 10000,
        lineTax: 1800,
        lineTotal: 11800,
      },
    ],
    subtotal: 10000,
    taxTotal: 1800,
    total: 11800,
    amountPaid: 0,
    balanceDue: 11800,
    version: 2,
    ...overrides,
  };
}

const paymentMethods = [
  { code: 'BANK_TRANSFER', displayName: 'Bank transfer', requiresReference: true, active: true, sortOrder: 1 },
  { code: 'CASH', displayName: 'Cash', requiresReference: false, active: true, sortOrder: 5 },
];

function renderRoutes(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/invoices" element={<InvoicesPage />} />
      <Route path="/invoices/new" element={<NewInvoicePage />} />
      <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
    </Routes>,
    { route },
  );
}

describe('invoice form rules', () => {
  const valid = {
    ...emptyInvoiceForm({ id: 1, name: 'Acme' }),
    lines: [{ description: 'Design', quantity: '1.5', unitPrice: '1000', taxRate: '18' }],
  };

  it('turns the form into a request, leaving empty dates and currency to Duewise', () => {
    expect(toRequest(invoiceFormSchema.parse(valid))).toEqual({
      clientId: 1,
      lines: [{ description: 'Design', quantity: 1.5, unitPrice: 1000, taxRate: 18 }],
    });
  });

  it('rejects a due date before the issue date and unfinished lines', () => {
    const result = invoiceFormSchema.safeParse({
      ...valid,
      issueDate: '2026-10-10',
      dueDate: '2026-10-01',
      lines: [{ description: '', quantity: '0', unitPrice: '-5', taxRate: '150' }],
    });
    const messages = Object.fromEntries(result.error!.issues.map((issue) => [issue.path.join('.'), issue.message]));
    expect(messages).toMatchObject({
      dueDate: 'Cannot be before the issue date',
      'lines.0.description': 'Describe the work or item',
      'lines.0.quantity': 'More than 0',
      'lines.0.unitPrice': '0 or more',
      'lines.0.taxRate': '0 to 100',
    });
  });

  it("maps Duewise's field names onto the form's", () => {
    expect(toFormPath('lines[2].unitPrice')).toBe('lines.2.unitPrice');
    expect(toFormPath('notes')).toBe('notes');
  });
});

describe('invoice list', () => {
  it('sends the chosen filters to Duewise and keeps them in the address', async () => {
    const queries: URLSearchParams[] = [];
    server.use(
      http.get('*/api/v1/invoices', ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          content: [
            {
              id: 5,
              invoiceNumber: 'INV-2026-00005',
              status: 'SENT',
              overdue: true,
              clientId: 1,
              clientName: 'Acme Design Studio',
              currencyCode: 'INR',
              issueDate: '2026-08-01',
              dueDate: '2026-08-31',
              total: 11800,
              balanceDue: 11800,
            },
          ],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        });
      }),
      http.get('*/api/v1/clients', () =>
        HttpResponse.json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      ),
    );

    renderRoutes('/invoices?overdue=true');

    expect(await screen.findByText('INV-2026-00005')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(queries.at(-1)?.get('overdue')).toBe('true');
    expect(queries.at(-1)?.get('sort')).toBe('issueDate');
    expect(queries.at(-1)?.get('direction')).toBe('desc');
  });
});

describe('new invoice', () => {
  it("starts from the client's currency and adds up the lines as you type", async () => {
    server.use(http.get('*/api/v1/clients/1', () => HttpResponse.json(aClient())));

    renderRoutes('/invoices/new?clientId=1');

    expect(await screen.findByDisplayValue('Acme Design Studio')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /Description/ }), 'Logo design');
    await userEvent.clear(screen.getByRole('textbox', { name: /Qty/ }));
    await userEvent.type(screen.getByRole('textbox', { name: /Qty/ }), '1.5');
    await userEvent.type(screen.getByRole('textbox', { name: /Unit price/ }), '333.33');
    await userEvent.type(screen.getByRole('textbox', { name: /Tax/ }), '18');

    // 1.5 × 333.33 = 499.995 → ₹500.00, plus 18% → ₹590.00
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('₹590.00');
  });

  it("shows Duewise's error for a line under that line's field", async () => {
    server.use(
      http.get('*/api/v1/clients/1', () => HttpResponse.json(aClient())),
      http.post('*/api/v1/invoices', () =>
        problem(400, 'VALIDATION_FAILED', 'One or more fields are invalid.', [
          { field: 'lines[0].unitPrice', message: 'INR allows at most 2 decimal places' },
        ]),
      ),
    );

    renderRoutes('/invoices/new?clientId=1');
    await userEvent.type(await screen.findByRole('textbox', { name: /Description/ }), 'Design');
    await userEvent.type(screen.getByRole('textbox', { name: /Unit price/ }), '10.125');
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }));

    expect(await screen.findByText('INR allows at most 2 decimal places')).toBeInTheDocument();
  });
});

describe('invoice page', () => {
  it('offers send, edit and delete for a draft, and sending gives it a number and emails it', async () => {
    let sent = false;
    let emailed = false;
    server.use(
      http.get('*/api/v1/invoices/17', () =>
        HttpResponse.json(sent ? anInvoice({ status: 'SENT', invoiceNumber: 'INV-2026-00043' }) : anInvoice()),
      ),
      http.get('*/api/v1/clients/1', () => HttpResponse.json(aClient({ billingEmail: 'accounts@acmedesign.in' }))),
      http.post('*/api/v1/invoices/17/send', () => {
        sent = true;
        return HttpResponse.json(anInvoice({ status: 'SENT', invoiceNumber: 'INV-2026-00043', version: 3 }));
      }),
      http.post('*/api/v1/invoices/17/email', () => {
        emailed = true;
        return HttpResponse.json({
          invoiceId: 17,
          invoiceNumber: 'INV-2026-00043',
          sentTo: 'accounts@acmedesign.in',
          sentAt: '2026-11-13T09:30:00Z',
        });
      }),
    );

    renderRoutes('/invoices/17');

    expect(await screen.findByRole('heading', { name: 'Draft 17' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/invoices/17/edit');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Email' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByRole('checkbox', { name: /Email it to the client \(accounts@acmedesign.in\)/ }),
    ).toBeChecked();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('heading', { name: 'INV-2026-00043' })).toBeInTheDocument();
    expect(await screen.findByText('Sent as INV-2026-00043 and emailed to accounts@acmedesign.in')).toBeInTheDocument();
    expect(emailed).toBe(true);
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Email' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('still sends when the email fails, and says so', async () => {
    let sent = false;
    server.use(
      http.get('*/api/v1/invoices/17', () =>
        HttpResponse.json(sent ? anInvoice({ status: 'SENT', invoiceNumber: 'INV-2026-00043' }) : anInvoice()),
      ),
      http.get('*/api/v1/clients/1', () => HttpResponse.json(aClient())),
      http.post('*/api/v1/invoices/17/send', () => {
        sent = true;
        return HttpResponse.json(anInvoice({ status: 'SENT', invoiceNumber: 'INV-2026-00043', version: 3 }));
      }),
      http.post('*/api/v1/invoices/17/email', () =>
        problem(502, 'EMAIL_FAILED', 'The mail server did not accept the email, so nothing was sent. Try again later.'),
      ),
    );

    renderRoutes('/invoices/17');
    await userEvent.click(await screen.findByRole('button', { name: 'Send' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/Sent as INV-2026-00043, but not emailed: The mail server/)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'INV-2026-00043' })).toBeInTheDocument();
  });

  it('sends without emailing when the box is cleared', async () => {
    let emailed = false;
    server.use(
      http.get('*/api/v1/invoices/17', () => HttpResponse.json(anInvoice())),
      http.get('*/api/v1/clients/1', () => HttpResponse.json(aClient())),
      http.post('*/api/v1/invoices/17/send', () =>
        HttpResponse.json(anInvoice({ status: 'SENT', invoiceNumber: 'INV-2026-00043', version: 3 })),
      ),
      http.post('*/api/v1/invoices/17/email', () => {
        emailed = true;
        return HttpResponse.json({});
      }),
    );

    renderRoutes('/invoices/17');
    await userEvent.click(await screen.findByRole('button', { name: 'Send' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Email it to the client/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Sent as INV-2026-00043')).toBeInTheDocument();
    expect(emailed).toBe(false);
  });

  it('emails a paid invoice again, and shows a mail failure in the dialog', async () => {
    let attempts = 0;
    server.use(
      http.get('*/api/v1/invoices/17', () =>
        HttpResponse.json(
          anInvoice({ status: 'PAID', invoiceNumber: 'INV-2026-00043', amountPaid: 11800, balanceDue: 0 }),
        ),
      ),
      http.get('*/api/v1/invoices/17/payments', () => HttpResponse.json([])),
      http.get('*/api/v1/clients/1', () => HttpResponse.json(aClient())),
      http.post('*/api/v1/invoices/17/email', () => {
        attempts += 1;
        return attempts === 1
          ? problem(
              502,
              'EMAIL_FAILED',
              'The mail server did not accept the email, so nothing was sent. Try again later.',
            )
          : HttpResponse.json({
              invoiceId: 17,
              invoiceNumber: 'INV-2026-00043',
              sentTo: 'accounts@acmedesign.in',
              sentAt: '2026-11-13T09:30:00Z',
            });
      }),
    );

    renderRoutes('/invoices/17');
    await userEvent.click(await screen.findByRole('button', { name: 'Email' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('accounts@acmedesign.in')).toBeInTheDocument();
    expect(within(dialog).getByText(/marked as paid in full/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Email' }));
    expect(await within(dialog).findByText(/did not accept the email/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Email' }));
    expect(await screen.findByText('Emailed to accounts@acmedesign.in')).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('asks for a reference when the payment method needs one, and shows an overpayment refusal', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get('*/api/v1/invoices/17', () =>
        HttpResponse.json(anInvoice({ status: 'SENT', invoiceNumber: 'INV-2026-00043' })),
      ),
      http.get('*/api/v1/payment-methods', () => HttpResponse.json(paymentMethods)),
      http.post('*/api/v1/invoices/17/payments', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return problem(422, 'OVERPAYMENT', 'A payment of 11800.00 INR is more than the balance due of 11000.00 INR.');
      }),
    );

    renderRoutes('/invoices/17');
    await userEvent.click(await screen.findByRole('button', { name: 'Record payment' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('textbox', { name: /Amount/ })).toHaveValue('11800.00');
    await userEvent.click(within(dialog).getByRole('combobox', { name: /Method/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Bank transfer' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    expect(await within(dialog).findByText('Required for this payment method')).toBeInTheDocument();
    expect(body).toBeUndefined();

    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reference/ }), 'UTR123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));

    expect(await within(dialog).findByText(/more than the balance due/)).toBeInTheDocument();
    expect(body).toMatchObject({ amount: 11800, paymentMethod: 'BANK_TRANSFER', reference: 'UTR123' });
  });

  it('needs a reason before voiding', async () => {
    let reason: unknown;
    const sent = anInvoice({ status: 'SENT', invoiceNumber: 'INV-2026-00043' });
    server.use(
      http.get('*/api/v1/invoices/17', () =>
        HttpResponse.json(reason ? { ...sent, status: 'VOID', voidReason: String(reason) } : sent),
      ),
      http.post('*/api/v1/invoices/17/void', async ({ request }) => {
        reason = ((await request.json()) as { reason: string }).reason;
        return HttpResponse.json(
          anInvoice({ status: 'VOID', invoiceNumber: 'INV-2026-00043', voidReason: String(reason) }),
        );
      }),
    );

    renderRoutes('/invoices/17');
    await userEvent.click(await screen.findByRole('button', { name: 'Void' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Void invoice' });

    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'Raised in error');
    await userEvent.click(confirm);

    await waitFor(() => expect(reason).toBe('Raised in error'));
    expect(await screen.findByText('Voided: Raised in error')).toBeInTheDocument();
  });
});
