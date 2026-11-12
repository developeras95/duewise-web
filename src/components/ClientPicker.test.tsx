import { afterEach, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { aClient, server } from '../test/server';
import { renderWithProviders } from '../test/render';
import { ClientPicker, type ClientOption } from './ClientPicker';

function Picker() {
  const [value, setValue] = useState<ClientOption | null>(null);
  return <ClientPicker value={value} onChange={setValue} />;
}

afterEach(() => vi.restoreAllMocks());

it('replaces the list with the search results, even when client names repeat', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  server.use(
    http.get('*/api/v1/clients', ({ request }) => {
      const content = new URL(request.url).searchParams.get('q')
        ? [aClient({ id: 50001, name: 'Sanvi Corps.', email: 'accounts@sanvi.example' })]
        : Array.from({ length: 5 }, (_, i) =>
            aClient({ id: i + 1, name: 'Bluebird Agro Co', email: `bluebird.${i + 1}@example.com` }),
          );
      return HttpResponse.json({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });
    }),
  );

  renderWithProviders(<Picker />);
  const input = screen.getByRole('combobox', { name: 'Client' });
  await userEvent.click(input);
  expect(await screen.findAllByRole('option')).toHaveLength(5);

  await userEvent.type(input, 'Sanvi');
  expect(await screen.findByRole('option', { name: /Sanvi Corps\./ })).toBeInTheDocument();
  expect(screen.getAllByRole('option')).toHaveLength(1);
  expect(errors.mock.calls.flat().join(' ')).not.toMatch(/same key/);
});
