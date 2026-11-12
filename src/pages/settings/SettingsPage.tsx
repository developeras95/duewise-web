import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { ApiError } from '../../api/client';
import { useCreateCurrency, useCurrencies, useUpdateCurrency, type Currency } from '../../api/currencies';
import {
  useCreatePaymentMethod,
  usePaymentMethods,
  useUpdatePaymentMethod,
  type PaymentMethod,
} from '../../api/invoices';
import { ErrorState } from '../../components/ErrorState';
import { useNotify } from '../../components/Notifications';
import { PageHeader } from '../../components/PageHeader';
import { useUrlParams } from '../../lib/useUrlParams';

function ActiveChip({ active }: { active?: boolean }) {
  return active ? (
    <Chip label="Active" size="small" color="success" variant="outlined" />
  ) : (
    <Chip label="Inactive" size="small" />
  );
}

/** A small add/edit dialog: shows Duewise's error, either under a field or above the form. */
function EditDialog({
  open,
  title,
  onClose,
  onSave,
  children,
  error,
  saving,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
  error: string | null;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <Box
        component="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box sx={{ display: 'grid', gap: 2, pt: 1 }}>{children}</Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={saving}>
            Save
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function errorText(error: unknown) {
  return error instanceof ApiError
    ? error.fieldErrors.length
      ? error.fieldErrors.map((v) => `${v.field}: ${v.message}`).join('; ')
      : error.message
    : 'Something went wrong.';
}

// ---- Currencies -----------------------------------------------------------------------------

function CurrencyDialog({ currency, onClose }: { currency: Currency | 'new'; onClose: () => void }) {
  const notify = useNotify();
  const create = useCreateCurrency();
  const update = useUpdateCurrency();
  const isNew = currency === 'new';
  const [code, setCode] = useState(isNew ? '' : currency.code!);
  const [name, setName] = useState(isNew ? '' : currency.name!);
  const [symbol, setSymbol] = useState(isNew ? '' : currency.symbol!);
  const [minorUnits, setMinorUnits] = useState(isNew ? 2 : currency.minorUnits!);
  const [active, setActive] = useState(isNew ? true : !!currency.active);
  const [error, setError] = useState<string | null>(null);
  const codeProblem = isNew && code !== '' && !/^[A-Z]{3}$/.test(code) ? 'Three capital letters, e.g. SGD' : null;

  const save = async () => {
    setError(null);
    try {
      if (isNew) await create.mutateAsync({ code, name: name.trim(), symbol: symbol.trim(), minorUnits });
      else await update.mutateAsync({ code, name: name.trim(), symbol: symbol.trim(), active });
      notify(isNew ? `${code} added` : `${code} saved`);
      onClose();
    } catch (failure) {
      setError(errorText(failure));
    }
  };

  return (
    <EditDialog
      open
      title={isNew ? 'Add a currency' : `Edit ${code}`}
      onClose={onClose}
      onSave={save}
      error={error}
      saving={create.isPending || update.isPending}
    >
      <TextField
        label="Code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        disabled={!isNew}
        required
        error={!!codeProblem}
        helperText={codeProblem ?? (isNew ? 'ISO 4217, e.g. SGD. Cannot be changed later.' : undefined)}
        slotProps={{ htmlInput: { maxLength: 3 } }}
      />
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        slotProps={{ htmlInput: { maxLength: 60 } }}
      />
      <TextField
        label="Symbol"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        required
        slotProps={{ htmlInput: { maxLength: 5 } }}
      />
      <TextField
        select
        label="Decimal places"
        value={minorUnits}
        onChange={(e) => setMinorUnits(Number(e.target.value))}
        disabled={!isNew}
        helperText={isNew ? '2 for most currencies, 0 for JPY, 3 for KWD. Cannot be changed later.' : undefined}
      >
        {[0, 1, 2, 3].map((value) => (
          <MenuItem key={value} value={value}>
            {value}
          </MenuItem>
        ))}
      </TextField>
      {!isNew && (
        <FormControlLabel
          control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
          label="Active: can be used on new invoices"
        />
      )}
    </EditDialog>
  );
}

function CurrenciesTab() {
  const currencies = useCurrencies();
  const [editing, setEditing] = useState<Currency | 'new' | null>(null);
  const columns: GridColDef<Currency>[] = [
    { field: 'code', headerName: 'Code', width: 90 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
    { field: 'symbol', headerName: 'Symbol', width: 90 },
    { field: 'minorUnits', headerName: 'Decimals', type: 'number', width: 100 },
    { field: 'active', headerName: 'Status', width: 110, renderCell: ({ value }) => <ActiveChip active={value} /> },
    {
      field: 'edit',
      headerName: '',
      width: 90,
      sortable: false,
      renderCell: ({ row }) => (
        <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(row)} aria-label={`Edit ${row.code}`}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}
      >
        <Typography color="text.secondary">
          Inactive currencies stay on existing invoices but cannot be chosen for new ones.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
          Add currency
        </Button>
      </Box>
      {currencies.isError ? (
        <ErrorState error={currencies.error} onRetry={() => currencies.refetch()} />
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <DataGrid
            rows={currencies.data ?? []}
            columns={columns}
            getRowId={(row) => row.code!}
            loading={currencies.isPending}
            hideFooter
            disableColumnMenu
            disableRowSelectionOnClick
            autoHeight
            sx={{ border: 0, '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' } }}
          />
        </Paper>
      )}
      {editing && <CurrencyDialog currency={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

// ---- Payment methods ------------------------------------------------------------------------

function PaymentMethodDialog({ method, onClose }: { method: PaymentMethod | 'new'; onClose: () => void }) {
  const notify = useNotify();
  const create = useCreatePaymentMethod();
  const update = useUpdatePaymentMethod();
  const isNew = method === 'new';
  const [code, setCode] = useState(isNew ? '' : method.code!);
  const [displayName, setDisplayName] = useState(isNew ? '' : method.displayName!);
  const [requiresReference, setRequiresReference] = useState(isNew ? false : !!method.requiresReference);
  const [sortOrder, setSortOrder] = useState(String(isNew ? 0 : (method.sortOrder ?? 0)));
  const [active, setActive] = useState(isNew ? true : !!method.active);
  const [error, setError] = useState<string | null>(null);
  const codeProblem =
    isNew && code !== '' && !/^[A-Z][A-Z0-9_]{0,29}$/.test(code)
      ? 'Capital letters, digits and _, starting with a letter'
      : null;
  const orderProblem = !/^\d{1,5}$/.test(sortOrder) || Number(sortOrder) > 32767 ? '0 to 32767' : null;

  const save = async () => {
    setError(null);
    try {
      const common = { displayName: displayName.trim(), requiresReference, sortOrder: Number(sortOrder) };
      if (isNew) await create.mutateAsync({ code, ...common });
      else await update.mutateAsync({ code, ...common, active });
      notify(isNew ? `${displayName.trim()} added` : `${displayName.trim()} saved`);
      onClose();
    } catch (failure) {
      setError(errorText(failure));
    }
  };

  return (
    <EditDialog
      open
      title={isNew ? 'Add a payment method' : `Edit ${method.displayName}`}
      onClose={onClose}
      onSave={save}
      error={error}
      saving={create.isPending || update.isPending}
    >
      <TextField
        label="Code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        disabled={!isNew}
        required
        error={!!codeProblem}
        helperText={codeProblem ?? (isNew ? 'e.g. PAYPAL. Cannot be changed later.' : undefined)}
        slotProps={{ htmlInput: { maxLength: 30 } }}
      />
      <TextField
        label="Name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
        slotProps={{ htmlInput: { maxLength: 60 } }}
      />
      <TextField
        label="Order"
        value={sortOrder}
        onChange={(e) => setSortOrder(e.target.value)}
        error={!!orderProblem}
        helperText={orderProblem ?? 'Lowest first in lists'}
        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
      />
      <FormControlLabel
        control={<Switch checked={requiresReference} onChange={(e) => setRequiresReference(e.target.checked)} />}
        label="Payments need a reference (transaction ID, cheque number)"
      />
      {!isNew && (
        <FormControlLabel
          control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
          label="Active: can be used for new payments"
        />
      )}
    </EditDialog>
  );
}

function PaymentMethodsTab() {
  const methods = usePaymentMethods();
  const [editing, setEditing] = useState<PaymentMethod | 'new' | null>(null);
  const columns: GridColDef<PaymentMethod>[] = [
    { field: 'displayName', headerName: 'Name', flex: 1, minWidth: 160 },
    { field: 'code', headerName: 'Code', width: 160 },
    {
      field: 'requiresReference',
      headerName: 'Reference',
      width: 120,
      valueFormatter: (value: boolean) => (value ? 'Required' : 'Optional'),
    },
    { field: 'sortOrder', headerName: 'Order', type: 'number', width: 80 },
    { field: 'active', headerName: 'Status', width: 110, renderCell: ({ value }) => <ActiveChip active={value} /> },
    {
      field: 'edit',
      headerName: '',
      width: 90,
      sortable: false,
      renderCell: ({ row }) => (
        <Button
          size="small"
          startIcon={<EditIcon />}
          onClick={() => setEditing(row)}
          aria-label={`Edit ${row.displayName}`}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}
      >
        <Typography color="text.secondary">
          Retired methods stay on past payments but cannot be chosen for new ones.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
          Add method
        </Button>
      </Box>
      {methods.isError ? (
        <ErrorState error={methods.error} onRetry={() => methods.refetch()} />
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <DataGrid
            rows={methods.data ?? []}
            columns={columns}
            getRowId={(row) => row.code!}
            loading={methods.isPending}
            hideFooter
            disableColumnMenu
            disableRowSelectionOnClick
            autoHeight
            sx={{ border: 0, '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' } }}
          />
        </Paper>
      )}
      {editing && <PaymentMethodDialog method={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

export function SettingsPage() {
  const url = useUrlParams();
  const tab = url.get('tab') === 'payment-methods' ? 'payment-methods' : 'currencies';

  return (
    <>
      <PageHeader title="Settings" subtitle="Currencies and payment methods used on invoices and payments." />
      <Tabs
        value={tab}
        onChange={(_, value: string) => url.update({ tab: value === 'currencies' ? undefined : value })}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Currencies" value="currencies" />
        <Tab label="Payment methods" value="payment-methods" />
      </Tabs>
      {tab === 'currencies' ? <CurrenciesTab /> : <PaymentMethodsTab />}
    </>
  );
}
