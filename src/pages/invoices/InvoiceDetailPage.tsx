import { useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import PaymentIcon from '@mui/icons-material/PaymentsOutlined';
import PreviewIcon from '@mui/icons-material/VisibilityOutlined';
import SendIcon from '@mui/icons-material/SendOutlined';
import VoidIcon from '@mui/icons-material/BlockOutlined';
import { useMinorUnits } from '../../api/currencies';
import {
  pdfUrl,
  useDeleteInvoice,
  useInvoice,
  usePayments,
  useSendInvoice,
  useVoidInvoice,
  type Invoice,
} from '../../api/invoices';
import { ErrorState } from '../../components/ErrorState';
import { InvoiceStatusChip } from '../../components/InvoiceStatusChip';
import { useNotify } from '../../components/Notifications';
import { PageHeader } from '../../components/PageHeader';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import { invoiceLabel } from '../../lib/invoiceLabels';
import { ConfirmDialog, RecordPaymentDialog, VoidDialog } from './InvoiceDialogs';

type OpenDialog = 'send' | 'delete' | 'void' | 'payment' | 'pdf' | null;

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

function Summary({ invoice }: { invoice: Invoice }) {
  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
        <Field label="Client">
          <Link component={RouterLink} to={`/clients/${invoice.client?.id}`}>
            {invoice.client?.name}
          </Link>
        </Field>
        <Field label="Issued">{formatDate(invoice.issueDate)}</Field>
        <Field label="Due">{formatDate(invoice.dueDate)}</Field>
        <Field label="Currency">{invoice.currencyCode}</Field>
        {invoice.sentAt && <Field label="Sent">{formatDateTime(invoice.sentAt)}</Field>}
        {invoice.paidAt && <Field label="Paid in full">{formatDateTime(invoice.paidAt)}</Field>}
        {invoice.voidedAt && <Field label="Voided">{formatDateTime(invoice.voidedAt)}</Field>}
      </Box>
      {invoice.voidReason && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Voided: {invoice.voidReason}
        </Alert>
      )}
      {invoice.notes && (
        <Box sx={{ mt: 2.5 }}>
          <Field label="Notes">
            <span style={{ whiteSpace: 'pre-line' }}>{invoice.notes}</span>
          </Field>
        </Box>
      )}
    </Paper>
  );
}

function Lines({ invoice, minorUnits }: { invoice: Invoice; minorUnits?: number }) {
  const money = (amount?: number) => formatMoney(amount, invoice.currencyCode, minorUnits);
  const lines = invoice.lines ?? [];
  const totals: [string, number | undefined, boolean?][] = [
    ['Subtotal', invoice.subtotal],
    ['Tax', invoice.taxTotal],
    ['Total', invoice.total, true],
    ['Paid', invoice.amountPaid],
    ['Balance due', invoice.balanceDue, true],
  ];

  return (
    <Paper sx={{ mb: 2, overflow: 'hidden' }}>
      <TableContainer>
        <Table size="small" aria-label="Invoice lines">
          <TableHead>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Unit price</TableCell>
              <TableCell align="right">Tax</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ color: 'text.secondary' }}>
                  No lines yet.
                </TableCell>
              </TableRow>
            )}
            {lines.map((line) => (
              <TableRow key={line.lineNo}>
                <TableCell>{line.description}</TableCell>
                <TableCell align="right">{line.quantity}</TableCell>
                <TableCell align="right">{money(line.unitPrice)}</TableCell>
                <TableCell align="right">{line.taxRate ? `${line.taxRate}%` : '–'}</TableCell>
                <TableCell align="right">{money(line.lineTotal)}</TableCell>
              </TableRow>
            ))}
            {totals.map(([label, amount, strong]) => (
              <TableRow key={label}>
                <TableCell colSpan={4} align="right" sx={{ border: 0, fontWeight: strong ? 600 : undefined }}>
                  {label}
                </TableCell>
                <TableCell align="right" sx={{ border: 0, fontWeight: strong ? 600 : undefined }}>
                  {money(amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function Payments({ invoice, minorUnits }: { invoice: Invoice; minorUnits?: number }) {
  const hasPayments = (invoice.amountPaid ?? 0) > 0;
  const payments = usePayments(invoice.id!, hasPayments);
  if (!hasPayments) return null;

  return (
    <Box component="section">
      <Typography variant="h2" sx={{ mb: 1.5 }}>
        Payments
      </Typography>
      {payments.isError && <ErrorState error={payments.error} onRetry={() => payments.refetch()} />}
      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small" aria-label="Payments">
            <TableHead>
              <TableRow>
                <TableCell>Paid on</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.isPending && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Skeleton />
                  </TableCell>
                </TableRow>
              )}
              {payments.data?.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{formatDate(payment.paidOn)}</TableCell>
                  <TableCell>{payment.paymentMethodName ?? payment.paymentMethod}</TableCell>
                  <TableCell>{payment.reference ?? '–'}</TableCell>
                  <TableCell align="right">{formatMoney(payment.amount, invoice.currencyCode, minorUnits)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

function Actions({ invoice, open }: { invoice: Invoice; open: (dialog: OpenDialog) => void }) {
  const status = invoice.status;
  const canPay = status === 'SENT' || status === 'PARTIALLY_PAID';
  const fileName = `${invoiceLabel(invoice).replace(' ', '-').toLowerCase()}.pdf`;

  return (
    <>
      {status === 'DRAFT' && (
        <>
          <Button variant="contained" startIcon={<SendIcon />} onClick={() => open('send')}>
            Send
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            component={RouterLink}
            to={`/invoices/${invoice.id}/edit`}
          >
            Edit
          </Button>
        </>
      )}
      {canPay && (
        <Button variant="contained" startIcon={<PaymentIcon />} onClick={() => open('payment')}>
          Record payment
        </Button>
      )}
      <Button variant="outlined" startIcon={<PreviewIcon />} onClick={() => open('pdf')}>
        PDF
      </Button>
      <Button
        variant="outlined"
        startIcon={<DownloadIcon />}
        component="a"
        href={pdfUrl(invoice.id!)}
        download={invoice.invoiceNumber ? `${invoice.invoiceNumber}.pdf` : fileName}
      >
        Download
      </Button>
      {status === 'DRAFT' && (
        <Button color="error" startIcon={<DeleteIcon />} onClick={() => open('delete')}>
          Delete
        </Button>
      )}
      {status === 'SENT' && (invoice.amountPaid ?? 0) === 0 && (
        <Button color="error" startIcon={<VoidIcon />} onClick={() => open('void')}>
          Void
        </Button>
      )}
    </>
  );
}

export function InvoiceDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const notify = useNotify();
  const minorUnits = useMinorUnits();
  const invoice = useInvoice(id);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const send = useSendInvoice(id);
  const voidInvoice = useVoidInvoice(id);
  const remove = useDeleteInvoice(invoice.data ?? { id });
  const close = () => setDialog(null);

  const data = invoice.data;
  const units = data?.currencyCode ? minorUnits.get(data.currencyCode) : undefined;

  return (
    <>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component={RouterLink} to="/invoices" underline="hover" color="inherit">
          Invoices
        </Link>
        <Typography color="text.primary">{data ? invoiceLabel(data) : '…'}</Typography>
      </Breadcrumbs>
      <PageHeader
        title={data ? invoiceLabel(data) : 'Invoice'}
        subtitle={data && <InvoiceStatusChip status={data.status} overdue={data.overdue} />}
        actions={data && <Actions invoice={data} open={setDialog} />}
      />

      {invoice.isPending && <Skeleton variant="rounded" height={320} />}
      {invoice.isError && <ErrorState error={invoice.error} onRetry={() => invoice.refetch()} />}
      {data && (
        <>
          <Summary invoice={data} />
          <Lines invoice={data} minorUnits={units} />
          <Payments invoice={data} minorUnits={units} />

          <ConfirmDialog
            open={dialog === 'send'}
            onClose={close}
            title="Send this invoice?"
            confirmLabel="Send"
            onConfirm={async () => {
              const sent = await send.mutateAsync();
              notify(`Sent as ${sent.invoiceNumber}`);
            }}
          >
            Duewise gives it the next invoice number for {data.issueDate?.slice(0, 4)} and locks it: after this it can
            no longer be edited or deleted, only paid or voided. The total is{' '}
            <strong>{formatMoney(data.total, data.currencyCode, units)}</strong>.
          </ConfirmDialog>

          <ConfirmDialog
            open={dialog === 'delete'}
            onClose={close}
            title="Delete this draft?"
            confirmLabel="Delete"
            danger
            onConfirm={async () => {
              await remove.mutateAsync();
              notify('Draft deleted');
              navigate('/invoices');
            }}
          >
            Draft {data.id} for {data.client?.name} and its lines are deleted for good.
          </ConfirmDialog>

          <VoidDialog
            open={dialog === 'void'}
            onClose={close}
            onVoid={async (reason) => {
              await voidInvoice.mutateAsync(reason);
              notify(`${data.invoiceNumber} voided`);
            }}
          />

          {dialog === 'payment' && (
            <RecordPaymentDialog
              open
              onClose={close}
              invoice={data}
              minorUnits={units ?? 2}
              onRecorded={(paidInFull) => notify(paidInFull ? 'Payment recorded: paid in full' : 'Payment recorded')}
            />
          )}

          <Dialog open={dialog === 'pdf'} onClose={close} fullWidth maxWidth="md">
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {invoiceLabel(data)}.pdf
              <IconButton onClick={close} aria-label="Close preview">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 0, height: '80vh' }}>
              <Box
                component="iframe"
                src={pdfUrl(id)}
                title="Invoice PDF"
                sx={{ border: 0, width: '100%', height: '100%' }}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
