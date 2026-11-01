import { z } from 'zod';
import type { Client, ClientRequest } from '../../api/clients';

const optionalText = (max: number) => z.string().trim().max(max, `At most ${max} characters`);

/**
 * The client form's rules, the same as Duewise's own (see ClientRequest in the OpenAPI document),
 * so most mistakes are shown before anything is sent. Duewise still checks everything again.
 */
export const clientFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'At most 200 characters'),
  email: z.string().trim().min(1, 'Email is required').max(254).email('Not a valid email address'),
  billingEmail: z
    .string()
    .trim()
    .max(254)
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Not a valid email address'),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\+?[0-9 ()-]{5,30}$/.test(value), 'Digits, spaces, ( ) and - only, 5 to 30'),
  taxId: optionalText(50),
  defaultCurrencyCode: z.string(),
  paymentTermsDays: z
    .string()
    .trim()
    .refine((value) => /^\d{1,3}$/.test(value) && Number(value) <= 365, 'A whole number of days from 0 to 365'),
  remindersEnabled: z.boolean(),
  address: z.object({
    line1: optionalText(200),
    line2: optionalText(200),
    city: optionalText(100),
    state: optionalText(100),
    postalCode: optionalText(20),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .refine((value) => value === '' || /^[A-Z]{2}$/.test(value), 'Two letters, e.g. IN'),
  }),
});

export type ClientFormValues = z.input<typeof clientFormSchema>;

export const emptyClientForm: ClientFormValues = {
  name: '',
  email: '',
  billingEmail: '',
  phone: '',
  taxId: '',
  defaultCurrencyCode: '',
  paymentTermsDays: '30',
  remindersEnabled: true,
  address: { line1: '', line2: '', city: '', state: '', postalCode: '', countryCode: '' },
};

/** A client as form values: missing fields become empty strings. */
export function toFormValues(client: Client): ClientFormValues {
  const address = client.address ?? {};
  return {
    name: client.name ?? '',
    email: client.email ?? '',
    billingEmail: client.billingEmail ?? '',
    phone: client.phone ?? '',
    taxId: client.taxId ?? '',
    defaultCurrencyCode: client.defaultCurrencyCode ?? '',
    paymentTermsDays: String(client.paymentTermsDays ?? 30),
    remindersEnabled: client.remindersEnabled ?? true,
    address: {
      line1: address.line1 ?? '',
      line2: address.line2 ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      postalCode: address.postalCode ?? '',
      countryCode: address.countryCode ?? '',
    },
  };
}

const orUndefined = (value: string) => (value === '' ? undefined : value);

/**
 * Checked form values as the request body. Empty fields are left out, which on an update clears
 * them (Duewise replaces the whole client); an address with nothing filled in is left out entirely.
 */
export function toRequest(values: z.output<typeof clientFormSchema>, version?: number): ClientRequest {
  const address = Object.fromEntries(
    Object.entries(values.address).map(([key, value]) => [key, orUndefined(value)]),
  ) as ClientRequest['address'];
  const hasAddress = Object.values(address ?? {}).some((value) => value !== undefined);
  return {
    name: values.name,
    email: values.email,
    billingEmail: orUndefined(values.billingEmail),
    phone: orUndefined(values.phone),
    taxId: orUndefined(values.taxId),
    defaultCurrencyCode: orUndefined(values.defaultCurrencyCode),
    paymentTermsDays: Number(values.paymentTermsDays),
    remindersEnabled: values.remindersEnabled,
    address: hasAddress ? address : undefined,
    version,
  };
}
