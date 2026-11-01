import { useState } from 'react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ApiError } from '../../api/client';
import { useClient, useCreateClient, useUpdateClient, type Client } from '../../api/clients';
import { useCurrencies } from '../../api/currencies';
import { ErrorState } from '../../components/ErrorState';
import { useNotify } from '../../components/Notifications';
import { PageHeader } from '../../components/PageHeader';
import { countryName } from '../../lib/format';
import { clientFormSchema, emptyClientForm, toFormValues, toRequest, type ClientFormValues } from './clientForm';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
      <Typography variant="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>{children}</Box>
    </Paper>
  );
}

interface ClientFormProps {
  /** The client being edited; absent when adding a new one. */
  client?: Client;
}

function ClientForm({ client }: ClientFormProps) {
  const navigate = useNavigate();
  const notify = useNotify();
  const currencies = useCurrencies(true);
  const create = useCreateClient();
  const update = useUpdateClient(client?.id ?? 0);
  const [conflict, setConflict] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting, errors },
  } = useForm<ClientFormValues, unknown, z.output<typeof clientFormSchema>>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client ? toFormValues(client) : emptyClientForm,
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    setConflict(null);
    try {
      const body = toRequest(values, client?.version);
      const saved = client ? await update.mutateAsync(body) : await create.mutateAsync(body);
      notify(client ? 'Client saved' : `${saved.name} added`);
      navigate(`/clients/${saved.id}`);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.code === 'CLIENT_EMAIL_TAKEN') {
        setError('email', { message: error.message }, { shouldFocus: true });
      } else if (error.code === 'CONCURRENT_MODIFICATION') {
        setConflict('Someone else changed this client while you were editing. Reload it to see their changes.');
      } else if (error.fieldErrors.length > 0) {
        error.fieldErrors.forEach((violation, index) =>
          setError(
            violation.field as FieldPath<ClientFormValues>,
            { message: violation.message },
            { shouldFocus: index === 0 },
          ),
        );
      } else {
        setError('root.server', { message: error.message });
      }
    }
  });

  const serverError = errors.root?.server?.message;
  const countryCode = useWatch({ control, name: 'address.countryCode' });

  /** A text field wired to the form. Its error, when there is one, replaces the hint under it. */
  const text = (
    name: FieldPath<ClientFormValues>,
    label: string,
    { helperText, ...extra }: { helperText?: string } & Record<string, unknown> = {},
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...extra}
          {...field}
          value={field.value as string}
          label={label}
          error={!!fieldState.error}
          helperText={fieldState.error?.message ?? helperText}
          fullWidth
        />
      )}
    />
  );

  return (
    <Box component="form" noValidate onSubmit={onSubmit} sx={{ maxWidth: 880 }}>
      {conflict && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        >
          {conflict}
        </Alert>
      )}
      {serverError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {serverError}
        </Alert>
      )}

      <Section title="Contact">
        {text('name', 'Name', { required: true, autoFocus: !client, sx: { gridColumn: { sm: '1 / -1' } } })}
        {text('email', 'Email', { required: true, type: 'email', helperText: 'Main contact; unique per client' })}
        {text('billingEmail', 'Billing email', {
          type: 'email',
          helperText: 'Where invoices and reminders go, if not the main email',
        })}
        {text('phone', 'Phone', { type: 'tel' })}
        {text('taxId', 'Tax ID', { helperText: 'GSTIN, VAT number or similar' })}
      </Section>

      <Section title="Address">
        {text('address.line1', 'Address line 1', { sx: { gridColumn: { sm: '1 / -1' } } })}
        {text('address.line2', 'Address line 2', { sx: { gridColumn: { sm: '1 / -1' } } })}
        {text('address.city', 'City')}
        {text('address.state', 'State or region')}
        {text('address.postalCode', 'Postal code')}
        {text('address.countryCode', 'Country code', {
          helperText:
            countryName(countryCode) && countryCode.length === 2 ? countryName(countryCode) : 'e.g. IN, US, GB',
          slotProps: { htmlInput: { maxLength: 2, style: { textTransform: 'uppercase' } } },
        })}
      </Section>

      <Section title="Billing">
        <Controller
          name="defaultCurrencyCode"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              select
              label="Default currency"
              error={!!fieldState.error}
              helperText={fieldState.error?.message ?? 'Pre-filled on new invoices'}
              fullWidth
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {(currencies.data ?? []).map((currency) => (
                <MenuItem key={currency.code} value={currency.code}>
                  {currency.code} · {currency.name}
                </MenuItem>
              ))}
              {/* Keep an inactive currency the client already has selectable. */}
              {field.value && !currencies.data?.some((currency) => currency.code === field.value) && (
                <MenuItem value={field.value}>{field.value}</MenuItem>
              )}
            </TextField>
          )}
        />
        {text('paymentTermsDays', 'Payment terms', {
          required: true,
          helperText: 'Days from issue date to due date; 0 = due on receipt',
          slotProps: {
            input: { endAdornment: <InputAdornment position="end">days</InputAdornment> },
            htmlInput: { inputMode: 'numeric' },
          },
        })}
        <Controller
          name="remindersEnabled"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              sx={{ gridColumn: { sm: '1 / -1' } }}
              control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
              label="Send overdue reminders to this client"
            />
          )}
        />
      </Section>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button component={RouterLink} to={client ? `/clients/${client.id}` : '/clients'} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={isSubmitting}>
          {client ? 'Save changes' : 'Add client'}
        </Button>
      </Box>
    </Box>
  );
}

export function NewClientPage() {
  return (
    <>
      <PageHeader title="New client" />
      <ClientForm />
    </>
  );
}

export function EditClientPage() {
  const id = Number(useParams().id);
  const client = useClient(id);

  return (
    <>
      <PageHeader title={client.data ? `Edit ${client.data.name}` : 'Edit client'} />
      {client.isPending && <Skeleton variant="rounded" height={420} sx={{ maxWidth: 880 }} />}
      {client.isError && <ErrorState error={client.error} onRetry={() => client.refetch()} />}
      {/* key: a fresh form whenever a newer version of the client is loaded */}
      {client.data && <ClientForm key={client.data.version} client={client.data} />}
    </>
  );
}
