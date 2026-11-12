import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dayjs from 'dayjs';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { ApiError } from '../../api/client';
import { usePaymentMethods, useRecordPayment, type Invoice } from '../../api/invoices';
import { formatMoney } from '../../lib/format';
import { decimalPlaces } from '../../lib/money';

interface DialogProps {
  open: boolean;
  onClose: () => void;
}

/** Voiding needs a reason, which stays on the invoice for the audit trail. */
export function VoidDialog({ open, onClose, onVoid }: DialogProps & { onVoid: (reason: string) => Promise<unknown> }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onVoid(reason.trim());
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Void this invoice?</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <DialogContentText sx={{ mb: 2 }}>
            A void invoice keeps its number, so there is no gap in the sequence, but nothing is owed on it any more.
            This cannot be undone.
          </DialogContentText>
          <TextField
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            fullWidth
            multiline
            minRows={2}
            autoFocus
            slotProps={{ htmlInput: { maxLength: 500 } }}
            helperText="Kept on the invoice, e.g. “Raised in error; replaced by INV-2026-00043”"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" color="error" loading={busy} disabled={!reason.trim()}>
            Void invoice
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

const DATE_FORMAT = 'YYYY-MM-DD';

function paymentSchema(balanceDue: number, minorUnits: number, requiresReference: (method: string) => boolean) {
  return z
    .object({
      amount: z
        .string()
        .trim()
        .refine((value) => /^\d+(\.\d+)?$/.test(value) && Number(value) > 0, 'More than 0')
        .refine((value) => decimalPlaces(value) <= minorUnits, `At most ${minorUnits} decimal places`)
        .refine((value) => Number(value) <= balanceDue, 'More than the balance due'),
      paymentMethod: z.string().min(1, 'Choose how it was paid'),
      paidOn: z.string().min(1, 'Required'),
      reference: z.string().trim().max(100),
      notes: z.string().trim().max(500),
    })
    .refine((form) => !requiresReference(form.paymentMethod) || form.reference !== '', {
      path: ['reference'],
      message: 'Required for this payment method',
    });
}

/** Records money received against the invoice. Duewise moves it to Partly paid or Paid. */
export function RecordPaymentDialog({
  open,
  onClose,
  invoice,
  minorUnits,
  onRecorded,
}: DialogProps & { invoice: Invoice; minorUnits: number; onRecorded: (paidInFull: boolean) => void }) {
  const methods = usePaymentMethods(true);
  const record = useRecordPayment(invoice);
  const balance = invoice.balanceDue ?? 0;
  const methodList = methods.data ?? [];
  const requiresReference = (code: string) =>
    methodList.find((method) => method.code === code)?.requiresReference ?? false;
  const schema = paymentSchema(balance, minorUnits, requiresReference);

  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: balance.toFixed(minorUnits),
      paymentMethod: '',
      paidOn: dayjs().format(DATE_FORMAT),
      reference: '',
      notes: '',
    },
  });
  const method = useWatch({ control, name: 'paymentMethod' });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const receipt = await record.mutateAsync({
        amount: Number(values.amount),
        paymentMethod: values.paymentMethod,
        paidOn: values.paidOn,
        reference: values.reference || undefined,
        notes: values.notes || undefined,
      });
      onRecorded(receipt.invoice?.status === 'PAID');
      close();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const field = (
        {
          OVERPAYMENT: 'amount',
          INVALID_AMOUNT_PRECISION: 'amount',
          AMOUNT_TOO_LARGE: 'amount',
          REFERENCE_REQUIRED: 'reference',
          INVALID_PAYMENT_DATE: 'paidOn',
          PAYMENT_METHOD_INACTIVE: 'paymentMethod',
          PAYMENT_METHOD_NOT_FOUND: 'paymentMethod',
        } as const
      )[error.code];
      if (field) setError(field, { message: error.message }, { shouldFocus: true });
      else if (error.fieldErrors.length)
        error.fieldErrors.forEach((v) => setError(v.field as 'amount', { message: v.message }));
      else setError('root.server', { message: error.message });
    }
  });

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : close} maxWidth="sm" fullWidth>
      <Box component="form" noValidate onSubmit={onSubmit}>
        <DialogTitle>Record a payment</DialogTitle>
        <DialogContent>
          {errors.root?.server?.message && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.root.server.message}
            </Alert>
          )}
          <DialogContentText sx={{ mb: 2 }}>
            Balance due: <strong>{formatMoney(balance, invoice.currencyCode, minorUnits)}</strong>
          </DialogContentText>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, pt: 1 }}>
            <Controller
              name="amount"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Amount"
                  required
                  autoFocus
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? 'The full balance, or part of it'}
                  slotProps={{
                    htmlInput: { inputMode: 'decimal' },
                    input: { endAdornment: <InputAdornment position="end">{invoice.currencyCode}</InputAdornment> },
                  }}
                />
              )}
            />
            <Controller
              name="paidOn"
              control={control}
              render={({ field, fieldState }) => (
                <DatePicker
                  label="Paid on"
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(value) => field.onChange(value?.isValid() ? value.format(DATE_FORMAT) : '')}
                  format="D MMM YYYY"
                  disableFuture
                  minDate={invoice.issueDate ? dayjs(invoice.issueDate) : undefined}
                  slotProps={{
                    textField: {
                      size: 'small',
                      required: true,
                      error: !!fieldState.error,
                      helperText: fieldState.error?.message,
                    },
                  }}
                />
              )}
            />
            <Controller
              name="paymentMethod"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  label="Method"
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                >
                  {methodList.map((option) => (
                    <MenuItem key={option.code} value={option.code}>
                      {option.displayName}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="reference"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Reference"
                  required={requiresReference(method)}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? 'Transaction ID, UTR or cheque number'}
                />
              )}
            />
            <Controller
              name="notes"
              control={control}
              render={({ field }) => <TextField {...field} label="Notes" sx={{ gridColumn: { sm: '1 / -1' } }} />}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={isSubmitting}>
            Record payment
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
