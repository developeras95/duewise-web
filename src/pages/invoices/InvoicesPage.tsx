import { Link as RouterLink, useNavigate } from 'react-router';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DataGrid, type GridColDef, type GridSortModel } from '@mui/x-data-grid';
import { useClient } from '../../api/clients';
import { useMinorUnits } from '../../api/currencies';
import {
  INVOICE_STATUSES,
  useInvoices,
  type InvoiceSortField,
  type InvoiceStatus,
  type InvoiceSummary,
} from '../../api/invoices';
import { ClientPicker } from '../../components/ClientPicker';
import { ErrorState } from '../../components/ErrorState';
import { InvoiceStatusChip } from '../../components/InvoiceStatusChip';
import { statusLabel } from '../../lib/invoiceLabels';
import { PageHeader } from '../../components/PageHeader';
import { formatDate, formatMoney } from '../../lib/format';
import { useUrlParams } from '../../lib/useUrlParams';

const SORT_FIELDS: InvoiceSortField[] = ['issueDate', 'dueDate', 'total', 'invoiceNumber', 'createdAt'];
const PAGE_SIZES = [20, 50, 100];
const DATE_FORMAT = 'YYYY-MM-DD';

function columns(minorUnits: Map<string, number>): GridColDef<InvoiceSummary>[] {
  const money = (value: number | undefined, row: InvoiceSummary) =>
    formatMoney(value, row.currencyCode, minorUnits.get(row.currencyCode!));
  return [
    {
      field: 'invoiceNumber',
      headerName: 'Invoice',
      width: 160,
      renderCell: ({ row }) =>
        row.invoiceNumber ?? (
          <Typography component="span" sx={{ fontStyle: 'italic', color: 'text.secondary', fontSize: 'inherit' }}>
            Draft {row.id}
          </Typography>
        ),
    },
    { field: 'clientName', headerName: 'Client', flex: 1, minWidth: 180, sortable: false },
    {
      field: 'status',
      headerName: 'Status',
      width: 190,
      sortable: false,
      renderCell: ({ row }) => <InvoiceStatusChip status={row.status} overdue={row.overdue} />,
    },
    { field: 'issueDate', headerName: 'Issued', width: 120, valueFormatter: (value: string) => formatDate(value) },
    { field: 'dueDate', headerName: 'Due', width: 120, valueFormatter: (value: string) => formatDate(value) },
    { field: 'total', headerName: 'Total', type: 'number', width: 150, valueFormatter: money },
    {
      field: 'balanceDue',
      headerName: 'Balance due',
      type: 'number',
      width: 150,
      sortable: false,
      valueFormatter: money,
    },
  ];
}

/** The client filter needs a name to show; when the page opens with ?clientId=7 it is looked up. */
function useSelectedClient(clientId: number | undefined) {
  const client = useClient(clientId ?? 0, clientId !== undefined);
  return clientId && client.data ? { id: clientId, name: client.data.name!, email: client.data.email } : null;
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const url = useUrlParams();
  const minorUnits = useMinorUnits();

  const statusParam = url.get('status') as InvoiceStatus | null;
  const sortParam = url.get('sort') as InvoiceSortField | null;
  const size = Number(url.get('size'));
  const clientId = Number(url.get('clientId')) || undefined;
  const params = {
    status: statusParam && INVOICE_STATUSES.includes(statusParam) ? statusParam : undefined,
    clientId,
    overdue: url.get('overdue') === 'true',
    issuedFrom: url.get('issuedFrom') ?? undefined,
    issuedTo: url.get('issuedTo') ?? undefined,
    page: Math.max(0, Number(url.get('page')) || 0),
    size: PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0],
    sort: sortParam && SORT_FIELDS.includes(sortParam) ? sortParam : ('issueDate' as const),
    direction: url.get('direction') === 'asc' ? ('asc' as const) : ('desc' as const),
  };
  const selectedClient = useSelectedClient(clientId);
  const invoices = useInvoices(params);

  /** Any filter change starts again at the first page. */
  const filter = (changes: Record<string, string | number | boolean | undefined>) =>
    url.update({ ...changes, page: undefined });

  const sortModel: GridSortModel = [{ field: params.sort, sort: params.direction }];
  const total = invoices.data?.totalElements ?? 0;
  const filtered = params.status || params.clientId || params.overdue || params.issuedFrom || params.issuedTo;

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={invoices.data ? `${total.toLocaleString()} ${total === 1 ? 'invoice' : 'invoices'}` : ' '}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={RouterLink}
            to={clientId ? `/invoices/new?clientId=${clientId}` : '/invoices/new'}
          >
            New invoice
          </Button>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          mb: 2,
          alignItems: 'center',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '160px minmax(220px, 1fr) 160px 160px auto auto' },
        }}
      >
        <TextField
          select
          label="Status"
          value={params.status ?? ''}
          onChange={(event) => filter({ status: event.target.value || undefined })}
        >
          <MenuItem value="">All</MenuItem>
          {INVOICE_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {statusLabel(status)}
            </MenuItem>
          ))}
        </TextField>
        <ClientPicker value={selectedClient} onChange={(client) => filter({ clientId: client?.id })} />
        <DatePicker
          label="Issued from"
          value={params.issuedFrom ? dayjs(params.issuedFrom) : null}
          onChange={(value) => filter({ issuedFrom: value?.isValid() ? value.format(DATE_FORMAT) : undefined })}
          format="D MMM YYYY"
          slotProps={{ textField: { size: 'small' }, field: { clearable: true } }}
        />
        <DatePicker
          label="Issued to"
          value={params.issuedTo ? dayjs(params.issuedTo) : null}
          onChange={(value) => filter({ issuedTo: value?.isValid() ? value.format(DATE_FORMAT) : undefined })}
          format="D MMM YYYY"
          slotProps={{ textField: { size: 'small' }, field: { clearable: true } }}
        />
        <FormControlLabel
          control={<Switch checked={params.overdue} onChange={(event) => filter({ overdue: event.target.checked })} />}
          label="Overdue only"
        />
        {filtered && (
          <Button
            onClick={() =>
              filter({
                status: undefined,
                clientId: undefined,
                overdue: undefined,
                issuedFrom: undefined,
                issuedTo: undefined,
              })
            }
          >
            Clear filters
          </Button>
        )}
      </Box>

      {invoices.isError ? (
        <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <DataGrid
            rows={invoices.data?.content ?? []}
            columns={columns(minorUnits)}
            getRowId={(row) => row.id!}
            rowCount={total}
            loading={invoices.isFetching}
            paginationMode="server"
            sortingMode="server"
            paginationModel={{ page: params.page, pageSize: params.size }}
            onPaginationModelChange={(model) =>
              url.update({
                page: model.page || undefined,
                size: model.pageSize === PAGE_SIZES[0] ? undefined : model.pageSize,
              })
            }
            pageSizeOptions={PAGE_SIZES}
            sortModel={sortModel}
            onSortModelChange={(model) => {
              const first = model[0];
              filter({
                sort: first && first.field !== 'issueDate' ? first.field : undefined,
                direction: first?.sort === 'asc' ? 'asc' : undefined,
              });
            }}
            disableColumnMenu
            disableRowSelectionOnClick
            onRowClick={({ row }) => navigate(`/invoices/${row.id}`)}
            localeText={{
              noRowsLabel: filtered ? 'No invoice matches these filters.' : 'No invoices yet. Create the first one.',
            }}
            sx={{
              border: 0,
              minHeight: 300,
              '& .MuiDataGrid-row': { cursor: 'pointer' },
              '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
            }}
          />
        </Paper>
      )}
    </>
  );
}
