import { useState, type ReactNode } from 'react';
import { Controller, useFieldArray, useForm, useWatch, type Control, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import dayjs from 'dayjs';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { ApiError } from '../../api/client';
import { useClient, type Client } from '../../api/clients';
import { useCurrencies } from '../../api/currencies';
import { useCreateInvoice, useInvoice, useUpdateInvoice, type Invoice } from '../../api/invoices';
import { ClientPicker } from '../../components/ClientPicker';
import { ErrorState } from '../../components/ErrorState';
import { useNotify } from '../../components/Notifications';
import { PageHeader } from '../../components/PageHeader';
import { formatDate, formatMoney } from '../../lib/format';
import { invoiceTotals, lineAmounts } from '../../lib/money';
import {
  emptyInvoiceForm,
  emptyLine,
  invoiceFormSchema,
  toFormPath,
  toFormValues,
  toRequest,
  type InvoiceFormValues,
} from './invoiceForm';

const DATE_FORMAT = 'YYYY-MM-DD';

/** Duewise error codes that belong to one field of this form. */
const FIELD_FOR_CODE: Record<string, FieldPath<InvoiceFormValues>> = {
  INVALID_DUE_DATE: 'dueDate',
  CURRENCY_INACTIVE: 'currencyCode',
  CURRENCY_NOT_FOUND: 'currencyCode',
  CURRENCY_REQUIRED: 'currencyCode',
  CLIENT_NOT_FOUND: 'client',
};

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h2">{title}</Typography>
        {action}
      </Box>
      {children}
    </Paper>
  );
}

/** The lines table, with each line's amounts and the invoice totals worked out as you type. */
function LinesEditor({
  control,
  minorUnits,
  currency,
}: {
  control: Control<InvoiceFormValues>;
  minorUnits: number;
  currency: string;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = useWatch({ control, name: 'lines' }) ?? [];
  const amounts = lines.map((line) => lineAmounts(line.quantity, line.unitPrice, line.taxRate, minorUnits));
  const totals = invoiceTotals(amounts, minorUnits);
  const money = (amount: number | undefined) =>
    currency ? formatMoney(amount, currency, minorUnits) : (amount ?? 0).toFixed(minorUnits);

  const cell = (
    index: number,
    name: 'description' | 'quantity' | 'unitPrice' | 'taxRate',
    label: string,
    extra: object = {},
  ) => (
    <Controller
      name={`lines.${index}.${name}`}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          label={label}
          error={!!fieldState.error}
          helperText={fieldState.error?.message}
          fullWidth
          {...extra}
        />
      )}
    />
  );

  return (
    <Section
      title="Lines"
      action={
        <Button startIcon={<AddIcon />} onClick={() => append({ ...emptyLine })} disabled={fields.length >= 100}>
          Add line
        </Button>
      }
    >
      {fields.length === 0 && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          No lines yet. A draft can be saved without lines, but it needs at least one to be sent.
        </Typography>
      )}
      {fields.map((field, index) => (
        <Box
          key={field.id}
          sx={{
            display: 'grid',
            gap: 1.5,
            mb: 2,
            pb: 2,
            borderBottom: 1,
            borderColor: 'divider',
            alignItems: 'start',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'minmax(220px, 3fr) 90px 140px 90px 140px 40px' },
          }}
        >
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
            {cell(index, 'description', 'Description', { required: true })}
          </Box>
          {cell(index, 'quantity', 'Qty', { required: true, slotProps: { htmlInput: { inputMode: 'decimal' } } })}
          {cell(index, 'unitPrice', 'Unit price', {
            required: true,
            slotProps: { htmlInput: { inputMode: 'decimal' } },
          })}
          {cell(index, 'taxRate', 'Tax', {
            placeholder: '0',
            slotProps: {
              htmlInput: { inputMode: 'decimal' },
              input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
            },
          })}
          <Box
            sx={{ textAlign: 'right', pt: 1, fontVariantNumeric: 'tabular-nums' }}
            aria-label={`Line ${index + 1} total`}
          >
            <Typography sx={{ fontWeight: 500 }}>{amounts[index] ? money(amounts[index].total) : '–'}</Typography>
            {amounts[index] && amounts[index].tax > 0 && (
              <Typography variant="caption" color="text.secondary">
                incl. {money(amounts[index].tax)} tax
              </Typography>
            )}
          </Box>
          <Tooltip title="Remove line">
            <IconButton onClick={() => remove(index)} aria-label={`Remove line ${index + 1}`} sx={{ mt: 0.5 }}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ))}

      <Box
        component="dl"
        sx={{
          m: 0,
          ml: 'auto',
          maxWidth: 320,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          rowGap: 0.5,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Typography component="dt" color="text.secondary">
          Subtotal
        </Typography>
        <Typography component="dd" sx={{ m: 0, textAlign: 'right' }}>
          {money(totals.subtotal)}
        </Typography>
        <Typography component="dt" color="text.secondary">
          Tax
        </Typography>
        <Typography component="dd" sx={{ m: 0, textAlign: 'right' }}>
          {money(totals.tax)}
        </Typography>
        <Typography component="dt" sx={{ fontWeight: 600 }}>
          Total
        </Typography>
        <Typography component="dd" sx={{ m: 0, textAlign: 'right', fontWeight: 600 }} data-testid="invoice-total">
          {money(totals.total)}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ textAlign: 'right', mt: 1 }}>
        Worked out with Duewise's rounding; Duewise calculates the final amounts when you save.
      </Typography>
    </Section>
  );
}

interface InvoiceFormProps {
  /** The draft being edited; absent for a new invoice. */
  invoice?: Invoice;
  /** For a new invoice opened from a client page. */
  initialClient?: Client;
}

function InvoiceForm({ invoice, initialClient }: InvoiceFormProps) {
  const navigate = useNavigate();
  const notify = useNotify();
  const currencies = useCurrencies();
  const create = useCreateInvoice();
  const update = useUpdateInvoice(invoice?.id ?? 0);
  const [conflict, setConflict] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState<number | undefined>(initialClient?.paymentTermsDays);

  const startClient = initialClient
    ? { id: initialClient.id!, name: initialClient.name!, email: initialClient.email }
    : null;
  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<InvoiceFormValues, unknown, z.output<typeof invoiceFormSchema>>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: invoice
      ? toFormValues(invoice)
      : emptyInvoiceForm(startClient, initialClient?.defaultCurrencyCode ?? ''),
    mode: 'onTouched',
  });

  const currencyCode = useWatch({ control, name: 'currencyCode' });
  const issueDate = useWatch({ control, name: 'issueDate' });
  const activeCurrencies = (currencies.data ?? []).filter(
    (currency) => currency.active || currency.code === currencyCode,
  );
  const minorUnits = currencies.data?.find((currency) => currency.code === currencyCode)?.minorUnits ?? 2;
  const dueDateHint =
    paymentTerms != null
      ? `Leave empty for ${formatDate(
          dayjs(issueDate || undefined)
            .add(paymentTerms, 'day')
            .format(DATE_FORMAT),
        )} (issue date + ${paymentTerms} days)`
      : "Leave empty for the issue date plus the client's payment terms";

  const onSubmit = handleSubmit(async (values) => {
    setConflict(false);
    try {
      const body = toRequest(values, invoice?.version);
      const saved = invoice ? await update.mutateAsync(body) : await create.mutateAsync(body);
      notify(invoice ? 'Draft saved' : 'Draft created');
      navigate(`/invoices/${saved.id}`);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.code === 'CONCURRENT_MODIFICATION') {
        setConflict(true);
      } else if (FIELD_FOR_CODE[error.code]) {
        setError(FIELD_FOR_CODE[error.code], { message: error.message }, { shouldFocus: true });
      } else if (error.fieldErrors.length > 0) {
        error.fieldErrors.forEach((violation, index) =>
          setError(
            toFormPath(violation.field) as FieldPath<InvoiceFormValues>,
            { message: violation.message },
            { shouldFocus: index === 0 },
          ),
        );
      } else {
        setError('root.server', { message: error.message });
      }
    }
  });

  const datePicker = (name: 'issueDate' | 'dueDate', label: string, helper: string) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <DatePicker
          label={label}
          value={field.value ? dayjs(field.value) : null}
          onChange={(value) => field.onChange(value?.isValid() ? value.format(DATE_FORMAT) : '')}
          format="D MMM YYYY"
          slotProps={{
            textField: {
              size: 'small',
              error: !!fieldState.error,
              helperText: fieldState.error?.message ?? helper,
              onBlur: field.onBlur,
            },
            field: { clearable: true },
          }}
        />
      )}
    />
  );

  return (
    <Box component="form" noValidate onSubmit={onSubmit} sx={{ maxWidth: 1040 }}>
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
          Someone else changed this draft while you were editing. Reload it to see their changes.
        </Alert>
      )}
      {errors.root?.server?.message && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.root.server.message}
        </Alert>
      )}

      <Section title="Details">
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '2fr 1fr 1fr 1fr' } }}>
          <Controller
            name="client"
            control={control}
            render={({ field, fieldState }) => (
              <ClientPicker
                value={field.value ?? null}
                onChange={(client, full) => {
                  field.onChange(client);
                  // A new client brings its own currency and payment terms.
                  if (full) {
                    setPaymentTerms(full.paymentTermsDays);
                    if (full.defaultCurrencyCode) setValue('currencyCode', full.defaultCurrencyCode);
                  }
                }}
                onBlur={field.onBlur}
                required
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="currencyCode"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                select
                label="Currency"
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? "Client's default if empty"}
              >
                <MenuItem value="">
                  <em>Client's default</em>
                </MenuItem>
                {activeCurrencies.map((currency) => (
                  <MenuItem key={currency.code} value={currency.code}>
                    {currency.code} · {currency.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          {datePicker('issueDate', 'Issue date', 'Leave empty for today')}
          {datePicker('dueDate', 'Due date', dueDateHint)}
        </Box>
      </Section>

      <LinesEditor control={control} minorUnits={minorUnits} currency={currencyCode} />

      <Section title="Notes">
        <Controller
          name="notes"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              label="Notes for the client"
              placeholder="Printed on the invoice, e.g. bank details or thanks"
              multiline
              minRows={2}
              fullWidth
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
            />
          )}
        />
      </Section>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button component={RouterLink} to={invoice ? `/invoices/${invoice.id}` : '/invoices'} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={isSubmitting}>
          {invoice ? 'Save draft' : 'Create draft'}
        </Button>
      </Box>
    </Box>
  );
}

export function NewInvoicePage() {
  const [searchParams] = useSearchParams();
  const clientId = Number(searchParams.get('clientId')) || 0;
  const client = useClient(clientId, clientId > 0);

  return (
    <>
      <PageHeader title="New invoice" subtitle="Saved as a draft: you can change it until you send it." />
      {clientId > 0 && client.isPending ? (
        <Skeleton variant="rounded" height={420} />
      ) : (
        <InvoiceForm initialClient={client.data} />
      )}
    </>
  );
}

export function EditInvoicePage() {
  const id = Number(useParams().id);
  const invoice = useInvoice(id);
  const client = useClient(invoice.data?.client?.id ?? 0, !!invoice.data);

  return (
    <>
      <PageHeader title={invoice.data ? `Edit draft ${invoice.data.id}` : 'Edit draft'} />
      {invoice.isPending && <Skeleton variant="rounded" height={420} />}
      {invoice.isError && <ErrorState error={invoice.error} onRetry={() => invoice.refetch()} />}
      {invoice.data && invoice.data.status !== 'DRAFT' && (
        <Alert severity="info">
          {invoice.data.invoiceNumber} has been sent, so it can no longer be changed.{' '}
          <RouterLink to={`/invoices/${id}`}>Back to the invoice</RouterLink>
        </Alert>
      )}
      {invoice.data?.status === 'DRAFT' && (
        <InvoiceForm key={invoice.data.version} invoice={invoice.data} initialClient={client.data} />
      )}
    </>
  );
}
