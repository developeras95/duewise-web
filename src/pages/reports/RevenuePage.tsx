import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/RefreshOutlined';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { BarChart } from '@mui/x-charts/BarChart';
import dayjs from 'dayjs';
import { useMinorUnits } from '../../api/currencies';
import { useRefreshRevenue, useRevenueReport, type RevenueMonth, type RevenueReport } from '../../api/reports';
import { ErrorState } from '../../components/ErrorState';
import { useNotify } from '../../components/Notifications';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime, formatMoney } from '../../lib/format';
import { monthLabel, monthRange, validMonth } from '../../lib/months';
import { useUrlParams } from '../../lib/useUrlParams';

type Preset = 'last12' | 'thisYear' | 'lastYear' | 'custom';

function presetRange(preset: Exclude<Preset, 'custom'>): { from?: string; to?: string } {
  const year = dayjs().year();
  if (preset === 'thisYear') return { from: `${year}-01`, to: dayjs().format('YYYY-MM') };
  if (preset === 'lastYear') return { from: `${year - 1}-01`, to: `${year - 1}-12` };
  return {};
}

function presetOf(from?: string, to?: string): Preset {
  if (!from && !to) return 'last12';
  for (const preset of ['thisYear', 'lastYear'] as const) {
    const range = presetRange(preset);
    if (range.from === from && range.to === to) return preset;
  }
  return 'custom';
}

/** One month's received amount in one currency, or undefined when nothing was received. */
function amountIn(rows: RevenueMonth[], month: string, currency: string) {
  return rows.find((row) => row.month === month && row.currencyCode === currency)?.received;
}

/** Where the numbers come from: the stored copy (and how old it is) and the live month. */
function Freshness({ report }: { report: RevenueReport }) {
  const asOf = formatDateTime(report.storedAsOf);
  const live = report.liveMonth ? monthLabel(report.liveMonth) : undefined;
  const allLive = report.liveMonth && report.from === report.liveMonth;
  return (
    <Alert severity="info" sx={{ mb: 3 }}>
      {allLive
        ? `${live} so far, added up live from the payments.`
        : live
          ? `Months before ${live} are as of ${asOf}; ${live} is live, up to the last payment recorded.`
          : `As of ${asOf}. Duewise refreshes finished months every night; payments recorded since then for these months show after the next refresh.`}
    </Alert>
  );
}

function CurrencyCard({
  currency,
  report,
  months,
  minorUnits,
}: {
  currency: string;
  report: RevenueReport;
  months: string[];
  minorUnits?: number;
}) {
  const theme = useTheme();
  const total = report.totals?.find((row) => row.currencyCode === currency);
  const rows = report.months ?? [];
  const money = (value: number | null) => formatMoney(value ?? 0, currency, minorUnits);
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary">
        {currency}
      </Typography>
      <Typography variant="h5" component="p" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {money(total?.received ?? 0)}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {(total?.payments ?? 0).toLocaleString()} {total?.payments === 1 ? 'payment' : 'payments'}
      </Typography>
      <BarChart
        height={220}
        margin={{ left: 8, right: 8 }}
        xAxis={[
          {
            scaleType: 'band',
            data: months.map((month) =>
              month === report.liveMonth ? `${monthLabel(month, true)} (so far)` : monthLabel(month, true),
            ),
          },
        ]}
        yAxis={[{ width: 72, valueFormatter: (value: number) => formatCompact(value) }]}
        series={[
          {
            data: months.map((month) => amountIn(rows, month, currency) ?? 0),
            label: `Received in ${currency}`,
            color: theme.palette.primary.main,
            valueFormatter: money,
          },
        ]}
        hideLegend
      />
    </Paper>
  );
}

/** 1250000 → "1.25M": axis labels only; the cards and the table show exact amounts. */
function formatCompact(value: number) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

/** Money received per month and currency, for a chosen period. */
export function RevenuePage() {
  const url = useUrlParams();
  const from = validMonth(url.get('from'));
  const to = validMonth(url.get('to'));
  const report = useRevenueReport(from, to);
  const refresh = useRefreshRevenue();
  const minorUnits = useMinorUnits();
  const notify = useNotify();
  const preset = presetOf(from, to);

  const data = report.data;
  const months = data?.from && data?.to ? monthRange(data.from, data.to) : [];
  const currencies = [...(data?.totals ?? [])]
    .sort((a, b) => (b.payments ?? 0) - (a.payments ?? 0))
    .map((total) => total.currencyCode!)
    .filter(Boolean);

  const choose = (month: dayjs.Dayjs | null, field: 'from' | 'to') => {
    if (month?.isValid()) url.update({ [field]: month.format('YYYY-MM') });
  };

  return (
    <>
      <PageHeader
        title="Revenue"
        subtitle={data?.from && data.to ? `${monthLabel(data.from)} to ${monthLabel(data.to)}` : ' '}
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            loading={refresh.isPending}
            onClick={async () => {
              try {
                const done = await refresh.mutateAsync();
                notify(`Finished months refreshed in ${(done.tookMs ?? 0).toLocaleString()} ms`);
              } catch (failure) {
                notify(failure instanceof Error ? failure.message : 'The refresh failed.', 'error');
              }
            }}
          >
            Refresh now
          </Button>
        }
      />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 3 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={preset}
          onChange={(_, value: Preset | null) => {
            if (value && value !== 'custom') url.update({ from: undefined, to: undefined, ...presetRange(value) });
          }}
          aria-label="Period"
        >
          <ToggleButton value="last12">Last 12 months</ToggleButton>
          <ToggleButton value="thisYear">This year</ToggleButton>
          <ToggleButton value="lastYear">Last year</ToggleButton>
        </ToggleButtonGroup>
        <DatePicker
          label="From"
          views={['year', 'month']}
          openTo="month"
          format="MMM YYYY"
          value={data?.from ? dayjs(`${data.from}-01`) : null}
          onChange={(value) => choose(value, 'from')}
          slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
        />
        <DatePicker
          label="To"
          views={['year', 'month']}
          openTo="month"
          format="MMM YYYY"
          value={data?.to ? dayjs(`${data.to}-01`) : null}
          onChange={(value) => choose(value, 'to')}
          slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
        />
      </Box>

      {report.isPending && <Skeleton variant="rounded" height={320} />}
      {report.isError && <ErrorState error={report.error} onRetry={() => report.refetch()} />}
      {data && (
        <>
          <Freshness report={data} />
          {currencies.length === 0 ? (
            <Typography color="text.secondary">No payments were received in this period.</Typography>
          ) : (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))',
                  mb: 3,
                }}
              >
                {currencies.map((currency) => (
                  <CurrencyCard
                    key={currency}
                    currency={currency}
                    report={data}
                    months={months}
                    minorUnits={minorUnits.get(currency)}
                  />
                ))}
              </Box>

              <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                By month
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" aria-label="Revenue by month">
                  <TableHead>
                    <TableRow>
                      <TableCell>Month</TableCell>
                      {currencies.map((currency) => (
                        <TableCell key={currency} align="right">
                          {currency}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...months].reverse().map((month) => (
                      <TableRow key={month}>
                        <TableCell component="th" scope="row">
                          {monthLabel(month)}
                          {month === data.liveMonth && (
                            <Typography component="span" variant="caption" color="text.secondary">
                              {' '}
                              (so far)
                            </Typography>
                          )}
                        </TableCell>
                        {currencies.map((currency) => {
                          const amount = amountIn(data.months ?? [], month, currency);
                          return (
                            <TableCell key={currency} align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                              {amount === undefined ? '–' : formatMoney(amount, currency, minorUnits.get(currency))}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </>
      )}
    </>
  );
}
