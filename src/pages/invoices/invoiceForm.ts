import { z } from 'zod';
import type { Invoice, InvoiceRequest } from '../../api/invoices';
import type { ClientOption } from '../../components/ClientPicker';
import { decimalPlaces } from '../../lib/money';

const decimal = /^\d+(\.\d+)?$/;

const lineSchema = z.object({
  description: z.string().trim().min(1, 'Describe the work or item').max(500, 'At most 500 characters'),
  quantity: z
    .string()
    .trim()
    .refine((value) => decimal.test(value) && Number(value) > 0, 'More than 0')
    .refine((value) => decimalPlaces(value) <= 3, 'At most 3 decimal places'),
  unitPrice: z
    .string()
    .trim()
    .refine((value) => decimal.test(value), '0 or more')
    .refine((value) => decimalPlaces(value) <= 3, 'Too many decimal places'),
  taxRate: z
    .string()
    .trim()
    .refine((value) => value === '' || (decimal.test(value) && Number(value) <= 100), '0 to 100')
    .refine((value) => decimalPlaces(value || '0') <= 2, 'At most 2 decimal places'),
});

/**
 * The draft editor's rules, the same as Duewise's (see InvoiceRequest in the OpenAPI document).
 * A draft may be saved without lines; Duewise only insists on lines when it is sent.
 */
export const invoiceFormSchema = z
  .object({
    client: z.custom<ClientOption | null>().refine((client) => client != null, 'Choose a client'),
    currencyCode: z.string(),
    issueDate: z.string(),
    dueDate: z.string(),
    notes: z.string().max(2000, 'At most 2000 characters'),
    lines: z.array(lineSchema).max(100, 'At most 100 lines'),
  })
  .refine((form) => !form.issueDate || !form.dueDate || form.dueDate >= form.issueDate, {
    path: ['dueDate'],
    message: 'Cannot be before the issue date',
  });

export type InvoiceFormValues = z.input<typeof invoiceFormSchema>;
export type InvoiceLineValues = z.input<typeof lineSchema>;

export const emptyLine: InvoiceLineValues = { description: '', quantity: '1', unitPrice: '', taxRate: '' };

export function emptyInvoiceForm(client: ClientOption | null = null, currencyCode = ''): InvoiceFormValues {
  return { client, currencyCode, issueDate: '', dueDate: '', notes: '', lines: [{ ...emptyLine }] };
}

/** "1.500" → "1.5": numbers from Duewise as the user would type them. */
function plain(value: number | undefined) {
  return value == null ? '' : String(value);
}

export function toFormValues(invoice: Invoice): InvoiceFormValues {
  return {
    client: invoice.client ? { id: invoice.client.id!, name: invoice.client.name! } : null,
    currencyCode: invoice.currencyCode ?? '',
    issueDate: invoice.issueDate ?? '',
    dueDate: invoice.dueDate ?? '',
    notes: invoice.notes ?? '',
    lines: (invoice.lines ?? []).map((line) => ({
      description: line.description ?? '',
      quantity: plain(line.quantity),
      unitPrice: plain(line.unitPrice),
      taxRate: line.taxRate ? plain(line.taxRate) : '',
    })),
  };
}

/**
 * Checked form values as the request body. Empty currency and dates are left out, so Duewise fills
 * them in from the client and today. The lines sent replace all lines of the draft.
 */
export function toRequest(values: z.output<typeof invoiceFormSchema>, version?: number): InvoiceRequest {
  return {
    clientId: values.client!.id,
    currencyCode: values.currencyCode || undefined,
    issueDate: values.issueDate || undefined,
    dueDate: values.dueDate || undefined,
    notes: values.notes.trim() || undefined,
    lines: values.lines.map((line) => ({
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      taxRate: line.taxRate ? Number(line.taxRate) : undefined,
    })),
    version,
  };
}

/** Duewise names line fields "lines[2].quantity"; the form calls the same field "lines.2.quantity". */
export function toFormPath(field: string) {
  return field.replace(/\[(\d+)\]/g, '.$1');
}
