import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import PersonAddIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import { useMinorUnits } from '../api/currencies';
import { useHealth } from '../api/health';
import { useInvoices, type InvoiceListParams, type InvoiceSummary } from '../api/invoices';
import { useReminderLog } from '../api/reminders';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { formatDate, formatDateTime, formatMoney } from '../lib/format';
import { invoiceLabel } from '../lib/invoiceLabels';

const COMPONENT_LABELS: Record<string, string> = {
  db: 'Database',
  mail: 'Mail server',
  diskSpace: 'Disk space',
  ping: 'API',
};

function StatusChip({ status }: { status: string }) {
  const color = status === 'UP' ? 'success' : status === 'DOWN' ? 'error' : 'default';
  return <Chip label={status} color={color} size="small" variant="outlined" />;
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper sx={{ p: 2.5, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5, gap: 1 }}>
        <Typography variant="h2">{title}</Typography>
        {action}
      </Box>
      {children}
    </Paper>
  );
}

/** System status: whether the API and everything it depends on are up. */
function SystemStatus() {
  const health = useHealth();

  return (
    <Card title="System status">
      {health.isPending && <Skeleton variant="rounded" height={96} />}
      {health.isError && <ErrorState error={health.error} onRetry={() => health.refetch()} />}
      {health.data && (
        <Stack spacing={1.25}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 600 }}>Duewise API</Typography>
            <StatusChip status={health.data.status} />
          </Box>
          {Object.entries(health.data.components ?? {})
            .filter(([name]) => name !== 'ping')
            .map(([name, component]) => (
              <Box key={name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography color="text.secondary">{COMPONENT_LABELS[name] ?? name}</Typography>
                <StatusChip status={component.status} />
              </Box>
            ))}
        </Stack>
      )}
    </Card>
  );
}

/** A short list of invoices with a count and a link to the full, filtered list. */
function InvoiceCard({
  title,
  params,
  seeAll,
  empty,
  detail,
}: {
  title: string;
  params: InvoiceListParams;
  seeAll: string;
  empty: string;
  detail: (invoice: InvoiceSummary) => ReactNode;
}) {
  const invoices = useInvoices(params);
  const minorUnits = useMinorUnits();
  const total = invoices.data?.totalElements;

  return (
    <Card
      title={title}
      action={
        <Button component={RouterLink} to={seeAll} size="small">
          See all{total != null ? ` ${total.toLocaleString()}` : ''}
        </Button>
      }
    >
      {invoices.isPending && <Skeleton variant="rounded" height={160} />}
      {invoices.isError && <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />}
      {invoices.data && invoices.data.content?.length === 0 && <Typography color="text.secondary">{empty}</Typography>}
      {invoices.data && (invoices.data.content?.length ?? 0) > 0 && (
        <List dense disablePadding sx={{ mx: -1 }}>
          {invoices.data.content!.map((invoice) => (
            <ListItemButton
              key={invoice.id}
              component={RouterLink}
              to={`/invoices/${invoice.id}`}
              sx={{ borderRadius: 1 }}
            >
              <ListItemText
                primary={
                  <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <span>
                      {invoiceLabel(invoice)} · {invoice.clientName}
                    </span>
                    <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatMoney(invoice.balanceDue, invoice.currencyCode, minorUnits.get(invoice.currencyCode!))}
                    </Box>
                  </Box>
                }
                secondary={detail(invoice)}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Card>
  );
}

function LatestReminder() {
  const log = useReminderLog(0, 1);
  const last = log.data?.content?.[0];

  return (
    <Card
      title="Reminders"
      action={
        <Button component={RouterLink} to="/reminders" size="small">
          Open
        </Button>
      }
    >
      {log.isPending && <Skeleton variant="rounded" height={48} />}
      {log.isError && <ErrorState error={log.error} onRetry={() => log.refetch()} />}
      {log.data && !last && <Typography color="text.secondary">No reminders sent yet.</Typography>}
      {last && (
        <Typography color="text.secondary">
          Latest: {last.type === 'OWNER_DIGEST' ? 'daily summary' : `reminder for invoice ${last.invoiceId}`},{' '}
          {last.status === 'SENT' ? 'sent' : 'failed'} {formatDateTime(last.sentAt ?? last.updatedAt)}.
        </Typography>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const today = dayjs();

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="What is overdue, what is waiting to be sent, and whether everything is running."
        actions={
          <>
            <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/invoices/new">
              New invoice
            </Button>
            <Button variant="outlined" startIcon={<PersonAddIcon />} component={RouterLink} to="/clients/new">
              New client
            </Button>
          </>
        }
      />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, alignItems: 'start' }}>
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <InvoiceCard
            title="Overdue"
            params={{ overdue: true, page: 0, size: 8, sort: 'dueDate', direction: 'asc' }}
            seeAll="/invoices?overdue=true&sort=dueDate&direction=asc"
            empty="Nothing is overdue."
            detail={(invoice) => `Due ${formatDate(invoice.dueDate)} · ${today.diff(invoice.dueDate, 'day')} days late`}
          />
          <InvoiceCard
            title="Drafts to send"
            params={{ status: 'DRAFT', page: 0, size: 5, sort: 'createdAt', direction: 'desc' }}
            seeAll="/invoices?status=DRAFT&sort=createdAt"
            empty="No drafts waiting."
            detail={(invoice) => `Issue date ${formatDate(invoice.issueDate)}`}
          />
        </Stack>
        <Stack spacing={2}>
          <LatestReminder />
          <SystemStatus />
        </Stack>
      </Box>
    </>
  );
}
