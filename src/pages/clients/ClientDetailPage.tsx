import type { ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import EditIcon from '@mui/icons-material/EditOutlined';
import { useClient, type Client } from '../../api/clients';
import { ErrorState } from '../../components/ErrorState';
import { PageHeader } from '../../components/PageHeader';
import { addressLines, formatDate } from '../../lib/format';
import { StatementSection } from './StatementSection';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography component="div">{children || '–'}</Typography>
    </Box>
  );
}

function ClientDetails({ client }: { client: Client }) {
  const address = addressLines(client.address);
  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <Field label="Email">
          <Link href={`mailto:${client.email}`}>{client.email}</Link>
        </Field>
        <Field label="Billing email">
          {client.billingEmail && <Link href={`mailto:${client.billingEmail}`}>{client.billingEmail}</Link>}
        </Field>
        <Field label="Phone">{client.phone}</Field>
        <Field label="Tax ID">{client.taxId}</Field>
        <Field label="Address">
          {address.map((line) => (
            <span key={line} style={{ display: 'block' }}>
              {line}
            </span>
          ))}
        </Field>
        <Field label="Default currency">{client.defaultCurrencyCode}</Field>
        <Field label="Payment terms">
          {client.paymentTermsDays === 0 ? 'Due on receipt' : `${client.paymentTermsDays} days`}
        </Field>
        <Field label="Overdue reminders">
          {client.remindersEnabled ? (
            <Chip label="On" size="small" color="success" variant="outlined" />
          ) : (
            <Chip label="Off" size="small" />
          )}
        </Field>
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2.5 }}>
        Client since {formatDate(client.createdAt)} · last changed {formatDate(client.updatedAt)}
      </Typography>
    </Paper>
  );
}

export function ClientDetailPage() {
  const id = Number(useParams().id);
  const client = useClient(id);

  return (
    <>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component={RouterLink} to="/clients" underline="hover" color="inherit">
          Clients
        </Link>
        <Typography color="text.primary">{client.data?.name ?? '…'}</Typography>
      </Breadcrumbs>
      <PageHeader
        title={client.data?.name ?? 'Client'}
        actions={
          client.data && (
            <Button variant="outlined" startIcon={<EditIcon />} component={RouterLink} to={`/clients/${id}/edit`}>
              Edit
            </Button>
          )
        }
      />
      {client.isPending && <Skeleton variant="rounded" height={180} />}
      {client.isError && <ErrorState error={client.error} onRetry={() => client.refetch()} />}
      {client.data && (
        <>
          <ClientDetails client={client.data} />
          <StatementSection clientId={id} />
        </>
      )}
    </>
  );
}
