import { describe, expect, it } from 'vitest';
import { clientFormSchema, emptyClientForm, toFormValues, toRequest } from './clientForm';
import { aClient } from '../../test/server';

describe('client form', () => {
  it('requires a name and a valid email, and limits payment terms to 0..365 days', () => {
    const result = clientFormSchema.safeParse({ ...emptyClientForm, email: 'not-an-email', paymentTermsDays: '400' });

    expect(result.success).toBe(false);
    const messages = Object.fromEntries(result.error!.issues.map((issue) => [issue.path.join('.'), issue.message]));
    expect(messages.name).toBe('Name is required');
    expect(messages.email).toBe('Not a valid email address');
    expect(messages.paymentTermsDays).toBe('A whole number of days from 0 to 365');
  });

  it('accepts a lower-case country code and sends it in capitals', () => {
    const values = clientFormSchema.parse({
      ...emptyClientForm,
      name: 'Acme',
      email: 'a@acme.in',
      address: { ...emptyClientForm.address, countryCode: 'in' },
    });

    expect(toRequest(values).address?.countryCode).toBe('IN');
  });

  it('leaves empty fields and an empty address out of the request, and sends the version on update', () => {
    const values = clientFormSchema.parse({ ...emptyClientForm, name: ' Acme ', email: 'a@acme.in' });

    expect(toRequest(values, 7)).toEqual({
      name: 'Acme',
      email: 'a@acme.in',
      paymentTermsDays: 30,
      remindersEnabled: true,
      version: 7,
    });
  });

  it('round-trips an existing client through the form unchanged', () => {
    const client = aClient({ address: { line1: 'MG Road', city: 'Bengaluru', countryCode: 'IN' } });

    const request = toRequest(clientFormSchema.parse(toFormValues(client)), client.version);

    expect(request).toEqual({
      name: client.name,
      email: client.email,
      billingEmail: client.billingEmail,
      phone: client.phone,
      taxId: client.taxId,
      defaultCurrencyCode: 'INR',
      paymentTermsDays: 30,
      remindersEnabled: true,
      address: { line1: 'MG Road', city: 'Bengaluru', countryCode: 'IN' },
      version: 3,
    });
  });
});
