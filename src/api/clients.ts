import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { components } from './schema';

export type Client = components['schemas']['Client'];
export type ClientRequest = components['schemas']['ClientRequest'];
export type Statement = components['schemas']['Statement'];

export type ClientSortField = 'name' | 'email' | 'createdAt';

export interface ClientListParams {
  q?: string;
  page: number;
  size: number;
  sort: ClientSortField;
  direction: 'asc' | 'desc';
}

export const clientKeys = {
  all: ['clients'] as const,
  list: (params: ClientListParams) => ['clients', 'list', params] as const,
  detail: (id: number) => ['clients', 'detail', id] as const,
  statement: (id: number) => ['clients', 'statement', id] as const,
};

/** One page of clients, optionally filtered by text in the name or email. */
export function useClients(params: ClientListParams) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/clients', {
        params: { query: { ...params, q: params.q || undefined } },
      });
      return data!;
    },
    // Keep showing the previous page while the next one loads, instead of an empty table.
    placeholderData: keepPreviousData,
  });
}

export function useClient(id: number) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/clients/{id}', { params: { path: { id } } });
      return data!;
    },
  });
}

/** Open invoices and balances per currency, split into aging buckets. */
export function useStatement(id: number) {
  return useQuery({
    queryKey: clientKeys.statement(id),
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/clients/{clientId}/statement', {
        params: { path: { clientId: id } },
      });
      return data!;
    },
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ClientRequest) => {
      const { data } = await api.POST('/api/v1/clients', { body });
      return data!;
    },
    onSuccess: (client) => {
      queryClient.setQueryData(clientKeys.detail(client.id!), client);
      return queryClient.invalidateQueries({ queryKey: [...clientKeys.all, 'list'] });
    },
  });
}

export function useUpdateClient(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ClientRequest) => {
      const { data } = await api.PUT('/api/v1/clients/{id}', { params: { path: { id } }, body });
      return data!;
    },
    onSuccess: (client) => {
      queryClient.setQueryData(clientKeys.detail(id), client);
      return queryClient.invalidateQueries({ queryKey: [...clientKeys.all, 'list'] });
    },
  });
}
