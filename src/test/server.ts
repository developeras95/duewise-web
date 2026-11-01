import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { components } from '../api/schema';

type Client = components['schemas']['Client'];

/** A client as Duewise returns it; override any field. */
export function aClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1,
    name: 'Acme Design Studio',
    email: 'asha@acmedesign.in',
    billingEmail: 'accounts@acmedesign.in',
    phone: '+91 80 4567 8900',
    taxId: '29ABCDE1234F1Z5',
    address: {
      line1: '4th Floor, Prestige Tower',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      countryCode: 'IN',
    },
    defaultCurrencyCode: 'INR',
    paymentTermsDays: 30,
    remindersEnabled: true,
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-02-01T10:00:00Z',
    version: 3,
    ...overrides,
  };
}

export const currencies: components['schemas']['Currency'][] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', minorUnits: 2, active: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', minorUnits: 2, active: true },
];

/** A Duewise problem detail response. */
export function problem(status: number, code: string, detail: string, errors?: { field: string; message: string }[]) {
  return HttpResponse.json(
    { title: 'Error', status, detail, code, ...(errors ? { errors } : {}) },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

/**
 * A stand-in for the Duewise API during tests. Tests add or replace handlers with server.use(...).
 * Any request without a handler fails the test, so nothing calls a real server by accident.
 */
export const server = setupServer(
  http.get('*/api/v1/currencies', () => HttpResponse.json(currencies)),
  http.get('*/actuator/health', () => HttpResponse.json({ status: 'UP', components: { db: { status: 'UP' } } })),
);
