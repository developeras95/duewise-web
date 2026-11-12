import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { components } from './schema';

export type ReminderSettings = components['schemas']['ReminderSettings'];
export type ReminderSettingsRequest = components['schemas']['ReminderSettingsRequest'];
export type ReminderRunSummary = components['schemas']['ReminderRunSummary'];
export type ReminderLogEntry = components['schemas']['ReminderLogEntry'];

const keys = {
  settings: ['reminders', 'settings'] as const,
  log: (page: number, size: number) => ['reminders', 'log', page, size] as const,
};

export function useReminderSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/settings/reminders');
      return data!;
    },
  });
}

export function useSaveReminderSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ReminderSettingsRequest) => {
      const { data } = await api.PUT('/api/v1/settings/reminders', { body });
      return data!;
    },
    onSuccess: (settings) => queryClient.setQueryData(keys.settings, settings),
  });
}

/** Every reminder attempt, newest first. */
export function useReminderLog(page: number, size: number) {
  return useQuery({
    queryKey: keys.log(page, size),
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/reminders/log', { params: { query: { page, size } } });
      return data!;
    },
    placeholderData: keepPreviousData,
  });
}

/** Does exactly what the daily schedule does; already-sent reminders are never sent twice. */
export function useRunReminders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.POST('/api/v1/reminders/run');
      return data!;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders', 'log'] }),
  });
}
