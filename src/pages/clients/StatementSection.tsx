import { Link as RouterLink } from 'react-router';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useStatement, type Statement } from '../../api/clients';
import { useMinorUnits } from '../../api/currencies';
import type { components } from '../../api/schema';
import { ErrorState } from '../../components/ErrorState';
import { formatDate, formatMoney } from '../../lib/format';

type OpenInvoice = components['schemas']['OpenInvoice'];
type CurrencyBalance = components['schemas']['CurrencyBalance'];
type Bucket = NonNullable<OpenInvoice['agingBucket']>;

/** Aging buckets from "not yet due" to "over 90 days late", each with a colour that gets warmer. */
const BUCKETS: { key: Bucket; field: keyof CurrencyBalance; label: string; color: string }[] = [
  { key: 'CURRENT', field: 'current', label: 'Not yet due', color: '#16a34a' },
  { key: 'DAYS_1_30', field: 'days1To30', label: '1–30 days', color: '#ca8a04' },
  { key: 'DAYS_31_60', field: 'days31To60', label: '31–60 days', color: '#ea580c' },
  { key: 'DAYS_61_90', field: 'days61To90', label: '61–90 days', color: '#dc2626' },
  { key: 'OVER_90', field: 'over90', label: 'Over 90 days', color: '#991b1b' },
];

function BucketChip({ bucket }: { bucket?: Bucket }) {
  const definition = BUCKETS.find((item) => item.key === bucket);
  if (!definition) return null;
  return (
    <Chip
      label={definition.label}
      size="small"
      variant="outlined"
      sx={{ borderColor: definition.color, color: definition.color, fontWeight: 500 }}
    />
  );
}

/** Total owed in one currency, with a bar showing how much of it is how late. */
function BalanceCard({ balance, minorUnits }: { balance: CurrencyBalance; minorUnits?: number }) {
  const total = balance.totalOutstanding ?? 0;
  const money = (amount?: number) => formatMoney(amount ?? 0, balance.currencyCode, minorUnits);

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="overline" color="text.secondary">
        {balance.currencyCode} · {balance.openInvoices?.toLocaleString()} open
      </Typography>
      <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, mb: 1.5 }}>{money(total)}</Typography>

      <Box
        role="img"
        aria-label="Outstanding amount by how late it is"
        sx={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', bgcolor: 'action.hover', mb: 1.5 }}
      >
        {BUCKETS.map((bucket) => {
          const amount = (balance[bucket.field] as number | undefined) ?? 0;
          return amount > 0 && total > 0 ? (
            <Tooltip key={bucket.key} title={`${bucket.label}: ${money(amount)}`}>
              <Box sx={{ width: `${(amount / total) * 100}%`, bgcolor: bucket.color }} />
            </Tooltip>
          ) : null;
        })}
      </Box>

      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 0.5, columnGap: 2 }}>
        {BUCKETS.map((bucket) => (
          <Box key={bucket.key} sx={{ display: 'contents' }}>
            <Box component="dt" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: bucket.color }} />
              {bucket.label}
            </Box>
            <Box component="dd" sx={{ m: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {money(balance[bucket.field] as number | undefined)}
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

function openInvoiceColumns(minorUnits: Map<string, number>): GridColDef<OpenInvoice>[] {
  return [
    {
      field: 'invoiceNumber',
      headerName: 'Invoice',
      flex: 1,
      minWidth: 150,
      renderCell: ({ row }) => (
        <Link component={RouterLink} to={`/invoices/${row.id}`} underline="hover">
          {row.invoiceNumber}
        </Link>
      ),
    },
    { field: 'currencyCode', headerName: 'Currency', width: 90 },
    { field: 'issueDate', headerName: 'Issued', width: 120, valueFormatter: (value: string) => formatDate(value) },
    { field: 'dueDate', headerName: 'Due', width: 120, valueFormatter: (value: string) => formatDate(value) },
    {
      field: 'daysOverdue',
      headerName: 'Days late',
      type: 'number',
      width: 100,
      valueFormatter: (value: number) => (value > 0 ? value.toLocaleString() : '–'),
    },
    {
      field: 'agingBucket',
      headerName: 'Age',
      width: 140,
      renderCell: ({ value }) => <BucketChip bucket={value as Bucket} />,
    },
    {
      field: 'balanceDue',
      headerName: 'Balance due',
      type: 'number',
      flex: 1,
      minWidth: 140,
      valueFormatter: (value: number, row) => formatMoney(value, row.currencyCode, minorUnits.get(row.currencyCode!)),
    },
  ];
}

function StatementContent({ statement }: { statement: Statement }) {
  const minorUnits = useMinorUnits();
  const balances = statement.balances ?? [];
  const invoices = statement.openInvoices ?? [];

  if (invoices.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">Nothing is owed: this client has no open invoices.</Typography>
      </Paper>
    );
  }

  return (
    <>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', mb: 2 }}>
        {balances.map((balance) => (
          <BalanceCard
            key={balance.currencyCode}
            balance={balance}
            minorUnits={minorUnits.get(balance.currencyCode!)}
          />
        ))}
      </Box>
      <Paper sx={{ overflow: 'hidden' }}>
        <DataGrid
          rows={invoices}
          columns={openInvoiceColumns(minorUnits)}
          getRowId={(row) => row.id!}
          density="compact"
          disableColumnMenu
          disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[25, 50, 100]}
          sx={{ border: 0 }}
        />
      </Paper>
    </>
  );
}

/** The client's statement: what is owed per currency, how late it is, and every open invoice. */
export function StatementSection({ clientId }: { clientId: number }) {
  const statement = useStatement(clientId);

  return (
    <Box component="section" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h2">Statement</Typography>
        {statement.data?.asOf && (
          <Typography variant="body2" color="text.secondary">
            as of {formatDate(statement.data.asOf)}
          </Typography>
        )}
      </Box>
      {statement.isPending && <Skeleton variant="rounded" height={220} />}
      {statement.isError && <ErrorState error={statement.error} onRetry={() => statement.refetch()} />}
      {statement.data && <StatementContent statement={statement.data} />}
    </Box>
  );
}
