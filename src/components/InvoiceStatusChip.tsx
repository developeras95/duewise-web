import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import type { InvoiceStatus } from '../api/invoices';
import { statusLabel } from '../lib/invoiceLabels';

const COLORS: Record<InvoiceStatus, 'default' | 'info' | 'warning' | 'success'> = {
  DRAFT: 'default',
  SENT: 'info',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  VOID: 'default',
};

/** An invoice's status, plus "Overdue" when money is owed past the due date. */
export function InvoiceStatusChip({ status, overdue }: { status?: InvoiceStatus; overdue?: boolean }) {
  if (!status) return null;
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Chip
        label={statusLabel(status)}
        color={COLORS[status]}
        size="small"
        variant={status === 'VOID' ? 'outlined' : 'filled'}
        sx={status === 'VOID' ? { textDecoration: 'line-through' } : undefined}
      />
      {overdue && <Chip label="Overdue" color="error" size="small" variant="outlined" />}
    </Stack>
  );
}
