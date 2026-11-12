import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import PlayIcon from '@mui/icons-material/PlayArrowOutlined';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { ApiError } from '../../api/client';
import {
  useReminderLog,
  useReminderSettings,
  useRunReminders,
  useSaveReminderSettings,
  type ReminderLogEntry,
  type ReminderRunSummary,
  type ReminderSettings,
} from '../../api/reminders';
import { ErrorState } from '../../components/ErrorState';
import { useNotify } from '../../components/Notifications';
import { PageHeader } from '../../components/PageHeader';
import { formatDate, formatDateTime } from '../../lib/format';
import { ConfirmDialog } from '../../components/ConfirmDialog';

type RecipientType = 'TO' | 'CC';
interface Recipient {
  email: string;
  type: RecipientType;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The reminder settings, edited together and saved at once (Duewise replaces them as a whole). */
function SettingsForm({ settings }: { settings: ReminderSettings }) {
  const notify = useNotify();
  const save = useSaveReminderSettings();
  const [clientReminders, setClientReminders] = useState(settings.clientRemindersEnabled ?? true);
  const [ownerDigest, setOwnerDigest] = useState(settings.ownerDigestEnabled ?? true);
  const [days, setDays] = useState<number[]>([...(settings.reminderDays ?? [])].sort((a, b) => a - b));
  const [newDay, setNewDay] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>(
    (settings.recipients ?? []).map((r) => ({ email: r.email, type: r.type as RecipientType })),
  );
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const dayValue = Number(newDay);
  const dayProblem =
    newDay === ''
      ? null
      : !/^\d+$/.test(newDay) || dayValue < 1 || dayValue > 365
        ? 'A whole number of days from 1 to 365'
        : days.includes(dayValue)
          ? 'Already in the list'
          : days.length >= 10
            ? 'At most 10 reminder days'
            : null;
  const addDay = () => {
    if (newDay && !dayProblem) {
      setDays([...days, dayValue].sort((a, b) => a - b));
      setNewDay('');
    }
  };

  const emailProblem = (email: string, index: number) => {
    if (!EMAIL.test(email.trim())) return 'Not a valid email address';
    const lower = email.trim().toLowerCase();
    if (recipients.some((other, i) => i < index && other.email.trim().toLowerCase() === lower)) return 'Listed twice';
    return null;
  };
  const invalid = days.length === 0 || recipients.some((r, i) => emailProblem(r.email, i));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        clientRemindersEnabled: clientReminders,
        ownerDigestEnabled: ownerDigest,
        reminderDays: days,
        recipients: recipients.map((r) => ({ email: r.email.trim(), type: r.type })),
        version: settings.version!,
      });
      notify('Reminder settings saved');
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'CONCURRENT_MODIFICATION') setConflict(true);
      else setError(failure instanceof Error ? failure.message : 'Something went wrong.');
    }
  };

  return (
    <Paper component="form" onSubmit={submit} noValidate sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h2" sx={{ mb: 2 }}>
        Settings
      </Typography>
      {conflict && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        >
          Someone else changed these settings in the meantime. Reload to see their changes.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={1} sx={{ mb: 3 }}>
        <FormControlLabel
          control={<Switch checked={clientReminders} onChange={(e) => setClientReminders(e.target.checked)} />}
          label="Remind clients about overdue invoices (invoice PDF attached)"
        />
        <FormControlLabel
          control={<Switch checked={ownerDigest} onChange={(e) => setOwnerDigest(e.target.checked)} />}
          label="Send me a daily summary of everything overdue"
        />
      </Stack>

      <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Reminder days</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        How many days after the due date each client reminder goes out. Clients who opted out never get one.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start', mb: 3 }}>
        {days.map((day) => (
          <Chip
            key={day}
            label={`${day} ${day === 1 ? 'day' : 'days'}`}
            onDelete={() => setDays(days.filter((d) => d !== day))}
            sx={{ mt: 0.5 }}
          />
        ))}
        {days.length === 0 && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            Add at least one day.
          </Typography>
        )}
        <TextField
          value={newDay}
          onChange={(e) => setNewDay(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addDay();
            }
          }}
          label="Add a day"
          error={!!dayProblem}
          helperText={dayProblem ?? ' '}
          sx={{ width: 160 }}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
        <Button onClick={addDay} disabled={!newDay || !!dayProblem} sx={{ mt: 0.5 }}>
          Add
        </Button>
      </Box>

      <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Daily summary recipients</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Who receives the owner summary. Up to 20 addresses.
      </Typography>
      <Stack spacing={1.5} sx={{ mb: 1 }}>
        {recipients.map((recipient, index) => {
          const problem = recipient.email ? emailProblem(recipient.email, index) : 'Required';
          return (
            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                select
                value={recipient.type}
                onChange={(e) =>
                  setRecipients(
                    recipients.map((r, i) => (i === index ? { ...r, type: e.target.value as RecipientType } : r)),
                  )
                }
                sx={{ width: 90 }}
                slotProps={{ htmlInput: { 'aria-label': `Recipient ${index + 1} type` } }}
              >
                <MenuItem value="TO">To</MenuItem>
                <MenuItem value="CC">Cc</MenuItem>
              </TextField>
              <TextField
                value={recipient.email}
                onChange={(e) =>
                  setRecipients(recipients.map((r, i) => (i === index ? { ...r, email: e.target.value } : r)))
                }
                label="Email"
                type="email"
                error={!!problem && recipient.email !== ''}
                helperText={recipient.email !== '' ? problem : undefined}
                sx={{ flex: 1, maxWidth: 420 }}
              />
              <Tooltip title="Remove">
                <IconButton
                  onClick={() => setRecipients(recipients.filter((_, i) => i !== index))}
                  aria-label={`Remove recipient ${index + 1}`}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Box>
          );
        })}
      </Stack>
      <Button
        startIcon={<AddIcon />}
        onClick={() => setRecipients([...recipients, { email: '', type: 'TO' }])}
        disabled={recipients.length >= 20}
      >
        Add recipient
      </Button>

      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, gap: 2, flexWrap: 'wrap' }}
      >
        <Typography variant="caption" color="text.secondary">
          Last changed {formatDateTime(settings.updatedAt)}. Changes apply from the next run.
        </Typography>
        <Button type="submit" variant="contained" loading={save.isPending} disabled={invalid}>
          Save settings
        </Button>
      </Box>
    </Paper>
  );
}

const DIGEST_RESULTS: Record<NonNullable<ReminderRunSummary['ownerDigest']>, string> = {
  SENT: 'sent',
  FAILED: 'failed (see the history below)',
  ALREADY_SENT_TODAY: 'already sent today',
  NOTHING_OVERDUE: 'not needed: nothing is overdue',
  NO_RECIPIENTS: 'not sent: no recipients',
  DISABLED: 'switched off',
};

function RunSummary({ summary }: { summary: ReminderRunSummary }) {
  const failed = (summary.clientRemindersFailed ?? 0) > 0 || summary.ownerDigest === 'FAILED';
  return (
    <Alert severity={failed ? 'warning' : 'success'} sx={{ mb: 2 }}>
      Run for {formatDate(summary.runDate)}: looked at {summary.overdueInvoices?.toLocaleString()} overdue invoices;{' '}
      {summary.clientRemindersSent} client reminders sent, {summary.clientRemindersFailed} failed,{' '}
      {summary.clientRemindersSkipped?.toLocaleString()} skipped. Daily summary:{' '}
      {summary.ownerDigest ? DIGEST_RESULTS[summary.ownerDigest] : '–'}.
    </Alert>
  );
}

const historyColumns: GridColDef<ReminderLogEntry>[] = [
  {
    field: 'sentAt',
    headerName: 'When',
    width: 170,
    valueGetter: (_, row) => row.sentAt ?? row.updatedAt,
    valueFormatter: (value: string) => formatDateTime(value),
  },
  {
    field: 'type',
    headerName: 'What',
    flex: 1,
    minWidth: 220,
    renderCell: ({ row }) =>
      row.type === 'OWNER_DIGEST' ? (
        <span>Daily summary for {formatDate(row.digestDate)}</span>
      ) : (
        <span>
          Reminder, day {row.reminderDay}, for{' '}
          <Link component={RouterLink} to={`/invoices/${row.invoiceId}`}>
            invoice {row.invoiceId}
          </Link>
        </span>
      ),
  },
  { field: 'recipients', headerName: 'To', flex: 1, minWidth: 200 },
  {
    field: 'status',
    headerName: 'Result',
    width: 110,
    renderCell: ({ row }) => (
      <Tooltip title={row.lastError ?? ''}>
        <Chip
          label={row.status === 'SENT' ? 'Sent' : 'Failed'}
          size="small"
          color={row.status === 'SENT' ? 'success' : 'error'}
          variant="outlined"
        />
      </Tooltip>
    ),
  },
  { field: 'attempts', headerName: 'Tries', type: 'number', width: 80 },
];

function History() {
  const [model, setModel] = useState({ page: 0, pageSize: 20 });
  const log = useReminderLog(model.page, model.pageSize);

  return (
    <Box component="section" sx={{ mt: 4 }}>
      <Typography variant="h2" sx={{ mb: 1.5 }}>
        History
      </Typography>
      {log.isError ? (
        <ErrorState error={log.error} onRetry={() => log.refetch()} />
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <DataGrid
            rows={log.data?.content ?? []}
            columns={historyColumns}
            getRowId={(row) => row.id!}
            rowCount={log.data?.totalElements ?? 0}
            loading={log.isFetching}
            paginationMode="server"
            paginationModel={model}
            onPaginationModelChange={setModel}
            pageSizeOptions={[20, 50, 100]}
            disableColumnMenu
            disableColumnSorting
            disableRowSelectionOnClick
            localeText={{ noRowsLabel: 'No reminders sent yet.' }}
            sx={{ border: 0, minHeight: 240, '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' } }}
          />
        </Paper>
      )}
    </Box>
  );
}

export function RemindersPage() {
  const settings = useReminderSettings();
  const run = useRunReminders();
  const notify = useNotify();
  const [confirm, setConfirm] = useState(false);
  const [summary, setSummary] = useState<ReminderRunSummary | null>(null);

  return (
    <>
      <PageHeader
        title="Reminders"
        subtitle="Overdue reminders to clients and a daily summary for you. They run every morning on their own."
        actions={
          <Button variant="outlined" startIcon={<PlayIcon />} onClick={() => setConfirm(true)} loading={run.isPending}>
            Run now
          </Button>
        }
      />
      {summary && <RunSummary summary={summary} />}
      {settings.isPending && <Skeleton variant="rounded" height={360} />}
      {settings.isError && <ErrorState error={settings.error} onRetry={() => settings.refetch()} />}
      {settings.data && <SettingsForm key={settings.data.version} settings={settings.data} />}
      <History />

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Run reminders now?"
        confirmLabel="Run now"
        onConfirm={async () => {
          const result = await run.mutateAsync();
          setSummary(result);
          notify('Reminder run finished');
        }}
      >
        This does exactly what the morning run does: every overdue invoice is checked, and reminders due today are
        emailed. Nothing is sent twice. With a very large number of overdue invoices this can take a while.
      </ConfirmDialog>
    </>
  );
}
