import { expect, test, type Page } from '@playwright/test';

/** Mailpit's API, where the stack's emails land (compose.yaml publishes it on 8026). */
const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8026';

/** A name and email no earlier run has used, so the test can run against any database. */
function uniqueClient() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return { name: `E2E Studio ${stamp}`, email: `e2e-${stamp}@example.test` };
}

async function addClient(page: Page, client: { name: string; email: string }) {
  await page.goto('/clients/new');
  await page.getByRole('textbox', { name: /^Name/ }).fill(client.name);
  await page.getByRole('textbox', { name: /^Email/ }).fill(client.email);
  await page.getByRole('combobox', { name: 'Default currency' }).click();
  await page.getByRole('option', { name: /^INR/ }).click();
  await page.getByRole('button', { name: 'Add client' }).click();
  await expect(page.getByRole('heading', { name: client.name })).toBeVisible();
}

test('the app is up and talking to Duewise', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Duewise API')).toBeVisible();
  await expect(page.getByText('Database')).toBeVisible();
  await expect(page.getByRole('button', { name: /Latest API request took/ })).toBeVisible();
});

test('from a new client to a paid invoice', async ({ page, request }) => {
  const client = uniqueClient();
  await addClient(page, client);
  await expect(page.getByText('Nothing is owed: this client has no open invoices.')).toBeVisible();

  // A draft with two lines; the totals are worked out as you type.
  await page.getByRole('link', { name: 'New invoice' }).click();
  await expect(page.getByRole('combobox', { name: /Client/ })).toHaveValue(client.name);
  await page.getByRole('textbox', { name: /Description/ }).fill('Brand identity');
  await page.getByRole('textbox', { name: /Unit price/ }).fill('45000');
  await page.getByRole('textbox', { name: /Tax/ }).fill('18');
  await page.getByRole('button', { name: 'Add line' }).click();
  await page
    .getByRole('textbox', { name: /Description/ })
    .nth(1)
    .fill('Consulting hours');
  await page.getByRole('textbox', { name: /Qty/ }).nth(1).fill('7.5');
  await page
    .getByRole('textbox', { name: /Unit price/ })
    .nth(1)
    .fill('2500');
  await page.getByRole('textbox', { name: /Tax/ }).nth(1).fill('18');
  await expect(page.getByTestId('invoice-total')).toHaveText('₹75,225.00');
  await page.getByRole('button', { name: 'Create draft' }).click();

  // Duewise calculated the same total.
  await expect(page.getByRole('heading', { name: /^Draft \d+$/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /^Total/ })).toContainText('₹75,225.00');

  // Sending gives it the next invoice number and emails it, PDF attached, to the client.
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(
    page.getByRole('checkbox', { name: `Email it to the client (${client.email}), PDF attached` }),
  ).toBeChecked();
  await page.getByRole('dialog').getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('heading', { name: /^INV-\d{4}-\d{5,}$/ })).toBeVisible();
  const invoiceNumber = (await page.getByRole('heading', { level: 1 }).textContent())!.trim();
  await expect(page.getByText(`Sent as ${invoiceNumber} and emailed to ${client.email}`)).toBeVisible();

  // The email really went out: Mailpit caught it, with the invoice number in the subject.
  const inbox = await request.get(`${MAILPIT_URL}/api/v1/search`, { params: { query: `to:${client.email}` } });
  const { messages } = (await inbox.json()) as { messages: { Subject: string; Attachments: number }[] };
  expect(messages).toHaveLength(1);
  expect(messages[0].Subject).toContain(invoiceNumber);
  expect(messages[0].Attachments).toBe(1);

  // The client now owes it.
  await page.getByRole('link', { name: client.name }).click();
  await expect(page.getByRole('link', { name: invoiceNumber })).toBeVisible();
  await expect(page.getByText('INR · 1 open')).toBeVisible();

  // Part payment, then the rest.
  await page.getByRole('link', { name: invoiceNumber }).click();
  await page.getByRole('button', { name: 'Record payment' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: /Amount/ }).fill('50000');
  await dialog.getByRole('combobox', { name: /Method/ }).click();
  await page.getByRole('option', { name: 'Cash' }).click();
  await dialog.getByRole('button', { name: 'Record payment' }).click();
  const status = page.getByRole('heading', { level: 1 }).locator('xpath=following-sibling::div');
  await expect(status.getByText('Partly paid')).toBeVisible();
  await expect(page.getByRole('row', { name: /^Balance due/ })).toContainText('₹25,225.00');

  await page.getByRole('button', { name: 'Record payment' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox', { name: /Amount/ })).toHaveValue('25225.00');
  await dialog.getByRole('combobox', { name: /Method/ }).click();
  await page.getByRole('option', { name: 'UPI' }).click();
  await dialog.getByRole('textbox', { name: /Reference/ }).fill('UTR-E2E-1');
  await dialog.getByRole('button', { name: 'Record payment' }).click();
  await expect(status.getByText('Paid', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record payment' })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Payments' }).getByRole('row')).toHaveCount(3);

  // Nothing is owed any more.
  await page.getByRole('link', { name: client.name }).click();
  await expect(page.getByText('Nothing is owed: this client has no open invoices.')).toBeVisible();
});

test("Duewise's own rules come back to the right field", async ({ page }) => {
  const client = uniqueClient();
  await addClient(page, client);

  // The same email again (in capitals): Duewise refuses it, and the form says so under Email.
  await page.goto('/clients/new');
  await page.getByRole('textbox', { name: /^Name/ }).fill(`${client.name} copy`);
  await page.getByRole('textbox', { name: /^Email/ }).fill(client.email.toUpperCase());
  await page.getByRole('button', { name: 'Add client' }).click();
  await expect(page.getByText(/already exists/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Email/ })).toHaveAttribute('aria-invalid', 'true');

  // A draft without lines can be saved, but not sent.
  await page.goto('/clients');
  await page.getByRole('searchbox', { name: 'Search clients' }).fill(client.email);
  await page.getByRole('gridcell', { name: client.name }).click();
  await page.getByRole('link', { name: 'New invoice' }).click();
  await page.getByRole('button', { name: 'Remove line 1' }).click();
  await page.getByRole('button', { name: 'Create draft' }).click();
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  // Delete the draft again.
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/invoices$/);
});
