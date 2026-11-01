import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { DataGrid, type GridColDef, type GridSortModel } from '@mui/x-data-grid';
import { useClients, type Client, type ClientSortField } from '../../api/clients';
import { ErrorState } from '../../components/ErrorState';
import { PageHeader } from '../../components/PageHeader';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

const SORT_FIELDS: ClientSortField[] = ['name', 'email', 'createdAt'];
const PAGE_SIZES = [20, 50, 100];

const columns: GridColDef<Client>[] = [
  {
    field: 'name',
    headerName: 'Name',
    flex: 1.4,
    minWidth: 180,
    renderCell: ({ row }) => <Typography sx={{ fontWeight: 500, fontSize: 'inherit' }}>{row.name}</Typography>,
  },
  {
    field: 'email',
    headerName: 'Email',
    flex: 1.4,
    minWidth: 200,
    renderCell: ({ row }) => (
      <span>
        {row.email}
        {row.billingEmail && row.billingEmail !== row.email && (
          <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Billing: {row.billingEmail}
          </Typography>
        )}
      </span>
    ),
  },
  { field: 'defaultCurrencyCode', headerName: 'Currency', width: 100, sortable: false },
  {
    field: 'paymentTermsDays',
    headerName: 'Terms',
    width: 100,
    sortable: false,
    valueFormatter: (value: number | undefined) => (value == null ? '' : value === 0 ? 'On receipt' : `${value} days`),
  },
  {
    field: 'remindersEnabled',
    headerName: 'Reminders',
    width: 120,
    sortable: false,
    renderCell: ({ value }) =>
      value ? <Chip label="On" size="small" color="success" variant="outlined" /> : <Chip label="Off" size="small" />,
  },
];

/** Reads list settings from the address, so Back, refresh and shared links keep the same view. */
function useListParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sortParam = searchParams.get('sort') as ClientSortField | null;
  const size = Number(searchParams.get('size'));
  return {
    q: searchParams.get('q') ?? '',
    page: Math.max(0, Number(searchParams.get('page')) || 0),
    size: PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0],
    sort: sortParam && SORT_FIELDS.includes(sortParam) ? sortParam : 'name',
    direction: searchParams.get('direction') === 'desc' ? ('desc' as const) : ('asc' as const),
    update(changes: Record<string, string | number | undefined>) {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === '') next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
  };
}

export function ClientsPage() {
  const navigate = useNavigate();
  const params = useListParams();
  const [search, setSearch] = useState(params.q);
  const debouncedSearch = useDebouncedValue(search.trim());

  // A new search starts again at the first page.
  useEffect(() => {
    if (debouncedSearch !== params.q) {
      params.update({ q: debouncedSearch, page: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const clients = useClients({
    q: params.q,
    page: params.page,
    size: params.size,
    sort: params.sort,
    direction: params.direction,
  });

  const sortModel: GridSortModel = [{ field: params.sort, sort: params.direction }];
  const total = clients.data?.totalElements ?? 0;

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={clients.data ? `${total.toLocaleString()} ${total === 1 ? 'client' : 'clients'}` : ' '}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/clients/new">
            New client
          </Button>
        }
      />

      <TextField
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by name or email"
        fullWidth
        sx={{ mb: 2, maxWidth: 480 }}
        slotProps={{
          htmlInput: { 'aria-label': 'Search clients', type: 'search' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      {clients.isError ? (
        <ErrorState error={clients.error} onRetry={() => clients.refetch()} />
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <DataGrid
            rows={clients.data?.content ?? []}
            columns={columns}
            getRowId={(row) => row.id!}
            getRowHeight={() => 'auto'}
            rowCount={total}
            loading={clients.isFetching}
            paginationMode="server"
            sortingMode="server"
            paginationModel={{ page: params.page, pageSize: params.size }}
            onPaginationModelChange={(model) =>
              params.update({
                page: model.page || undefined,
                size: model.pageSize === PAGE_SIZES[0] ? undefined : model.pageSize,
              })
            }
            pageSizeOptions={PAGE_SIZES}
            sortModel={sortModel}
            onSortModelChange={(model) => {
              const first = model[0];
              params.update({
                sort: first && first.field !== 'name' ? first.field : undefined,
                direction: first?.sort === 'desc' ? 'desc' : undefined,
                page: undefined,
              });
            }}
            disableColumnMenu
            disableRowSelectionOnClick
            onRowClick={({ row }) => navigate(`/clients/${row.id}`)}
            localeText={{
              noRowsLabel: params.q ? `No client matches “${params.q}”.` : 'No clients yet. Add the first one.',
            }}
            sx={{
              border: 0,
              '& .MuiDataGrid-row': { cursor: 'pointer' },
              '& .MuiDataGrid-cell': { py: 1, display: 'flex', alignItems: 'center' },
              minHeight: 300,
            }}
          />
        </Paper>
      )}
    </>
  );
}
