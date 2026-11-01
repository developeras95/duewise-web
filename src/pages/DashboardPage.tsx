import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useHealth } from '../api/health';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';

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

/** System status: whether the API and everything it depends on are up. */
function SystemStatus() {
  const health = useHealth();

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="h2" sx={{ mb: 2 }}>
        System status
      </Typography>
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
    </Paper>
  );
}

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="What is owed, what is overdue, and what needs attention." />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="h2" sx={{ mb: 1 }}>
            Receivables
          </Typography>
          <Typography color="text.secondary">
            Totals owed and overdue by currency, and the invoices that need attention, arrive with the invoice screens.
          </Typography>
        </Paper>
        <SystemStatus />
      </Box>
    </>
  );
}
