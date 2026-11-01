import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './client';
import { clientKeys } from './clients';
import type { components } from './schema';

export type Invoice = components['schemas']['Invoice'];
export type InvoiceSummary = components['schemas']['InvoiceSummary'];
export type InvoiceRequest = components['schemas']['InvoiceRequest'];
export type InvoiceStatus = NonNullable<Invoice['status']>;
export type Payment = components['schemas']['Payment'];
export type PaymentRequest = components['schemas']['PaymentRequest'];
export type PaymentMethod = components['schemas']['PaymentMethod'];

export const INVOICE_STATUSES: InvoiceStatus[] = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID'];
export type InvoiceSortField = 'issueDate' | 'dueDate' | 'total' | 'invoiceNumber' | 'createdAt';

export interface InvoiceListParams {
  status?: InvoiceStatus;
  clientId?: number;
  overdue?: boolean;
  issuedFrom?: string;
  issuedTo?: string;
  page: number;
  size: number;
  sort: InvoiceSortField;
  direction: 'asc' | 'desc';
}

export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (params: InvoiceListParams) => ['invoices', 'list', params] as const,
  detail: (id: number) => ['invoices', 'detail', id] as const,
  payments: (id: number) => ['invoices', 'payments', id] as const,
};

/** After any change to an invoice: refresh it, every invoice list, and its client's statement. */
function invoiceChanged(queryClient: QueryClient, invoice: Pick<Invoice, 'id' | 'client'>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
    invoice.client?.id != null
      ? queryClient.invalidateQueries({ queryKey: clientKeys.statement(invoice.client.id) })
      : undefined,
  ]);
}

/** One page of invoices with the given filters. */
export function useInvoices(params: InvoiceListParams) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/invoices', {
        params: { query: { ...params, overdue: params.overdue || undefined } },
      });
      return data!;
    },
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/invoices/{id}', { params: { path: { id } } });
      return data!;
    },
  });
}

export function usePayments(invoiceId: number, enabled = true) {
  return useQuery({
    queryKey: invoiceKeys.payments(invoiceId),
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/invoices/{invoiceId}/payments', {
        params: { path: { invoiceId } },
      });
      return data!;
    },
    enabled,
  });
}

/** Payment methods in display order; they rarely change, so they are cached for 10 minutes. */
export function usePaymentMethods(active?: boolean) {
  return useQuery({
    queryKey: ['payment-methods', active ?? 'all'],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/payment-methods', { params: { query: { active } } });
      return data!;
    },
    staleTime: 10 * 60_000,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: InvoiceRequest) => {
      const { data } = await api.POST('/api/v1/invoices', { body });
      return data!;
    },
    onSuccess: (invoice) => {
      queryClient.setQueryData(invoiceKeys.detail(invoice.id!), invoice);
      return invoiceChanged(queryClient, invoice);
    },
  });
}

export function useUpdateInvoice(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: InvoiceRequest) => {
      const { data } = await api.PUT('/api/v1/invoices/{id}', { params: { path: { id } }, body });
      return data!;
    },
    onSuccess: (invoice) => {
      queryClient.setQueryData(invoiceKeys.detail(id), invoice);
      return invoiceChanged(queryClient, invoice);
    },
  });
}

export function useDeleteInvoice(invoice: Invoice) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.DELETE('/api/v1/invoices/{id}', { params: { path: { id: invoice.id! } } });
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: invoiceKeys.detail(invoice.id!) });
      return invoiceChanged(queryClient, invoice);
    },
  });
}

/** Issues a draft: Duewise gives it the next invoice number and locks it against edits. */
export function useSendInvoice(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.POST('/api/v1/invoices/{id}/send', { params: { path: { id } } });
      return data!;
    },
    onSuccess: (invoice) => {
      queryClient.setQueryData(invoiceKeys.detail(id), invoice);
      return invoiceChanged(queryClient, invoice);
    },
  });
}

export function useVoidInvoice(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) => {
      const { data } = await api.POST('/api/v1/invoices/{id}/void', {
        params: { path: { id } },
        body: { reason },
      });
      return data!;
    },
    onSuccess: (invoice) => {
      queryClient.setQueryData(invoiceKeys.detail(id), invoice);
      return invoiceChanged(queryClient, invoice);
    },
  });
}

export function useRecordPayment(invoice: Invoice) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: PaymentRequest) => {
      const { data } = await api.POST('/api/v1/invoices/{invoiceId}/payments', {
        params: { path: { invoiceId: invoice.id! } },
        body,
      });
      return data!;
    },
    onSuccess: () => invoiceChanged(queryClient, invoice),
  });
}

/**
 * Address of the invoice's PDF. Duewise sends it "inline" with its file name (INV-2026-00042.pdf),
 * so the same address works for the in-page preview and for a download link.
 */
export function pdfUrl(id: number) {
  return `/api/v1/invoices/${id}/pdf`;
}
