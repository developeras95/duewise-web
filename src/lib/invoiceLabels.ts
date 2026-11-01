import type { Invoice, InvoiceStatus } from '../api/invoices';

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIALLY_PAID: 'Partly paid',
  PAID: 'Paid',
  VOID: 'Void',
};

/** "Partly paid" for PARTIALLY_PAID, and so on. */
export function statusLabel(status: InvoiceStatus) {
  return STATUS_LABELS[status];
}

/** "INV-2026-00042", or "Draft 17" before the invoice has a number. */
export function invoiceLabel(invoice: Pick<Invoice, 'invoiceNumber' | 'id'>) {
  return invoice.invoiceNumber ?? `Draft ${invoice.id}`;
}
